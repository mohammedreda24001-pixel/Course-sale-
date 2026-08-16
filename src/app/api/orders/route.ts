import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ordersRepository } from '@/modules/database/orders-repository';
import { orderSupportRepository } from '@/modules/database/order-support-repository';
import {
  normalizeCreateOrderInput,
  normalizeOrderUpdates
} from '@/modules/orders/normalize-order-input';
import { prepareOrderForShipping } from '@/modules/shipping/prepare-order';

function parseOrderId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('معرف الطلب غير صالح');
  }
  return id;
}

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');
    const receiptNumber = searchParams.get('receiptNumber');

    if (idStr) {
      const order = await ordersRepository.getById(parseOrderId(idStr));
      if (!order) {
        return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    const orders = await ordersRepository.list();

    if (receiptNumber) {
      const order = orders.find(o => o.receiptNumber === receiptNumber);
      if (!order) {
        return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    return NextResponse.json(orders);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب الطلبات';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const normalized = normalizeCreateOrderInput(body);
    const { totalPrice: _calculatedTotal, ...orderInput } = normalized;

    // Core order/code allocation remains inside the existing atomic DB workflow.
    const order = await ordersRepository.create({
      ...orderInput,
      createdById: user.id,
      createdByUsername: user.username
    });

    const [settings, courseTypes] = await Promise.all([
      orderSupportRepository.getSettings(),
      orderSupportRepository.getCourseTypes()
    ]);

    const courseObj = courseTypes.find(c => c.id === normalized.courseTypeId);
    const courseName = courseObj ? courseObj.name : '';

    let confirmationMessage = settings.confirmationTemplate;

    const calculatedTotalPriceVal = order.totalPrice * 1000;
    const calculatedCoursePriceVal = (order.basePrice !== undefined
      ? order.basePrice
      : (order.totalPrice - (order.deliveryFee ?? 0))) * 1000;

    const formattedTotalPrice = calculatedTotalPriceVal.toLocaleString();
    const formattedCoursePrice = calculatedCoursePriceVal.toLocaleString();
    const formattedDeliveryFee = ((order.deliveryFee ?? 0) * 1000).toLocaleString();

    confirmationMessage = confirmationMessage
      .replace(/{name}/g, order.studentName)
      .replace(/{{StudentName}}/g, order.studentName)
      .replace(/{{name}}/g, order.studentName)
      .replace(/{phone1}/g, order.phone1)
      .replace(/{{Phone1}}/g, order.phone1)
      .replace(/{{phone1}}/g, order.phone1)
      .replace(/{phone2}/g, order.phone2 ? `${order.phone2}` : 'لا يوجد')
      .replace(/{{Phone2}}/g, order.phone2 ? `${order.phone2}` : 'لا يوجد')
      .replace(/{{phone2}}/g, order.phone2 ? `${order.phone2}` : 'لا يوجد')
      .replace(/{province}/g, order.province)
      .replace(/{{Province}}/g, order.province)
      .replace(/{{province}}/g, order.province)
      .replace(/{region}/g, order.region || 'غير محددة')
      .replace(/{{Region}}/g, order.region || 'غير محددة')
      .replace(/{{region}}/g, order.region || 'غير محددة')
      .replace(/{address}/g, order.address)
      .replace(/{{Address}}/g, order.address)
      .replace(/{{address}}/g, order.address)
      .replace(/{landmark}/g, order.landmark ? `${order.landmark}` : 'لا يوجد')
      .replace(/{{Landmark}}/g, order.landmark ? `${order.landmark}` : 'لا يوجد')
      .replace(/{{landmark}}/g, order.landmark ? `${order.landmark}` : 'لا يوجد')
      .replace(/{packageSize}/g, order.packageSize || 'غير محدد')
      .replace(/{{PackageSize}}/g, order.packageSize || 'غير محدد')
      .replace(/{{packageSize}}/g, order.packageSize || 'غير محدد')
      .replace(/{piecesCount}/g, String(order.piecesCount ?? 1))
      .replace(/{{PiecesCount}}/g, String(order.piecesCount ?? 1))
      .replace(/{code}/g, order.StudentVaultCode_ID)
      .replace(/{{Code}}/g, order.StudentVaultCode_ID)
      .replace(/{{code}}/g, order.StudentVaultCode_ID)
      .replace(/{{CourseCode}}/g, order.StudentVaultCode_ID)
      .replace(/{serial}/g, order.StudentVaultCode_Serial)
      .replace(/{{Serial}}/g, order.StudentVaultCode_Serial)
      .replace(/{{serial}}/g, order.StudentVaultCode_Serial)
      .replace(/{{CourseSerial}}/g, order.StudentVaultCode_Serial)
      .replace(/{course}/g, courseName)
      .replace(/{{CourseName}}/g, courseName)
      .replace(/{{course}}/g, courseName)
      .replace(/{{CourseType}}/g, courseName)
      .replace(/{price}/g, formattedCoursePrice)
      .replace(/{{Price}}/g, formattedCoursePrice)
      .replace(/{{price}}/g, formattedCoursePrice)
      .replace(/{{CoursePrice}}/g, formattedCoursePrice)
      .replace(/{deliveryFee}/g, formattedDeliveryFee)
      .replace(/{{DeliveryFee}}/g, formattedDeliveryFee)
      .replace(/{totalPrice}/g, formattedTotalPrice)
      .replace(/{{TotalPrice}}/g, formattedTotalPrice)
      .replace(/{{totalPrice}}/g, formattedTotalPrice)
      .replace(/{{TotalAmount}}/g, formattedTotalPrice);

    const shippingReadiness = prepareOrderForShipping(order);

    return NextResponse.json({
      success: true,
      order,
      confirmationMessage,
      shippingReadiness
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الطلب';
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح. حذف الطلبات يتطلب صلاحيات المدير.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });
    }

    const success = await ordersRepository.remove(parseOrderId(idStr));
    if (!success) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف الطلب بنجاح وإرجاع الكود للمخزن' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء حذف الطلب';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const id = parseOrderId(body.id);

    if (body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates)) {
      const currentOrder = await ordersRepository.getById(id);
      if (!currentOrder) {
        return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
      }

      const updates = normalizeOrderUpdates(body.updates as Record<string, unknown>, currentOrder);
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'لا توجد بيانات صالحة للتحديث' }, { status: 400 });
      }

      const updatedOrder = await ordersRepository.update(id, updates);
      return NextResponse.json({
        success: true,
        order: updatedOrder,
        shippingReadiness: prepareOrderForShipping(updatedOrder)
      });
    }

    if (body.statusId !== undefined) {
      const statusId = Number(body.statusId);
      if (!Number.isInteger(statusId) || statusId < 1) {
        return NextResponse.json({ error: 'حالة الطلب غير صالحة' }, { status: 400 });
      }
      const updatedOrder = await ordersRepository.updateStatus(id, statusId);
      return NextResponse.json({ success: true, order: updatedOrder });
    }

    return NextResponse.json({ error: 'بيانات التحديث غير صالحة' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء تحديث الطلب';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
