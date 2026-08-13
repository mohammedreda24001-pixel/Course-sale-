import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');
    const receiptNumber = searchParams.get('receiptNumber');

    const orders = await db.getOrders();

    if (idStr) {
      const id = parseInt(idStr, 10);
      const order = orders.find(o => o.id === id);
      if (!order) {
        return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    if (receiptNumber) {
      const order = orders.find(o => o.receiptNumber === receiptNumber);
      if (!order) {
        return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const { 
      studentName, 
      phone1, 
      phone2, 
      province, 
      address, 
      landmark, 
      totalPrice,
      piecesCount,
      hasReturn,
      goodsType,
      returnDescription,
      receiptNumber,
      notes,
      manualCode,
      manualSerial,
      courseTypeId,
      internalNotes,
      telegramUsername,
      statusId,
      basePrice,
      deliveryFee
    } = await req.json();

    if (!studentName || !phone1 || !province || !address) {
      return NextResponse.json({ error: 'الاسم، رقم الهاتف، المحافظة، والعنوان حقول إجبارية.' }, { status: 400 });
    }

    const selectedCourseId = Number(courseTypeId) || 1;
    const cleanTelegramUsername = telegramUsername ? telegramUsername.trim() : '';

    // Attempt to create the order and link a code
    const order = await db.createOrder(
      studentName,
      phone1,
      phone2 || '',
      province,
      address,
      landmark || '',
      totalPrice || 250, // Default price in thousands (e.g. 250 representing 250,000)
      { id: user.id, username: user.username },
      piecesCount || 1,
      hasReturn || 'لا',
      goodsType || 'كورس تعليمي',
      returnDescription || '',
      receiptNumber || '',
      notes || '',
      manualCode || undefined,
      manualSerial || undefined,
      selectedCourseId,
      internalNotes || '',
      cleanTelegramUsername,
      Number(statusId) || 1,
      basePrice !== undefined ? Number(basePrice) : undefined,
      deliveryFee !== undefined ? Number(deliveryFee) : undefined
    );

    // Fetch template settings and course types to compile the response message
    const [settings, courseTypes] = await Promise.all([
      db.getSettings(),
      db.getCourseTypes()
    ]);
    
    const courseObj = courseTypes.find(c => c.id === selectedCourseId);
    const courseName = courseObj ? courseObj.name : '';

    let confirmationMessage = settings.confirmationTemplate;

    // Dynamic price calculations in dinars
    const calculatedTotalPriceVal = order.totalPrice * 1000;
    const calculatedCoursePriceVal = (order.basePrice !== undefined ? order.basePrice : (order.totalPrice - 5)) * 1000;

    const formattedTotalPrice = calculatedTotalPriceVal.toLocaleString();
    const formattedCoursePrice = calculatedCoursePriceVal.toLocaleString();

    // String formatting helper to replace placeholders (supports both brackets and double curly braces)
    confirmationMessage = confirmationMessage
      // Student Name
      .replace(/{name}/g, order.studentName)
      .replace(/{{StudentName}}/g, order.studentName)
      .replace(/{{name}}/g, order.studentName)
      // Phone 1
      .replace(/{phone1}/g, order.phone1)
      .replace(/{{Phone1}}/g, order.phone1)
      .replace(/{{phone1}}/g, order.phone1)
      // Phone 2
      .replace(/{phone2}/g, order.phone2 ? `${order.phone2}` : 'لا يوجد')
      .replace(/{{Phone2}}/g, order.phone2 ? `${order.phone2}` : 'لا يوجد')
      .replace(/{{phone2}}/g, order.phone2 ? `${order.phone2}` : 'لا يوجد')
      // Province
      .replace(/{province}/g, order.province)
      .replace(/{{Province}}/g, order.province)
      .replace(/{{province}}/g, order.province)
      // Address
      .replace(/{address}/g, order.address)
      .replace(/{{Address}}/g, order.address)
      .replace(/{{address}}/g, order.address)
      // Landmark
      .replace(/{landmark}/g, order.landmark ? `${order.landmark}` : 'لا يوجد')
      .replace(/{{Landmark}}/g, order.landmark ? `${order.landmark}` : 'لا يوجد')
      .replace(/{{landmark}}/g, order.landmark ? `${order.landmark}` : 'لا يوجد')
      // Code
      .replace(/{code}/g, order.StudentVaultCode_ID)
      .replace(/{{Code}}/g, order.StudentVaultCode_ID)
      .replace(/{{code}}/g, order.StudentVaultCode_ID)
      .replace(/{{CourseCode}}/g, order.StudentVaultCode_ID)
      // Serial
      .replace(/{serial}/g, order.StudentVaultCode_Serial)
      .replace(/{{Serial}}/g, order.StudentVaultCode_Serial)
      .replace(/{{serial}}/g, order.StudentVaultCode_Serial)
      .replace(/{{CourseSerial}}/g, order.StudentVaultCode_Serial)
      // Course Name
      .replace(/{course}/g, courseName)
      .replace(/{{CourseName}}/g, courseName)
      .replace(/{{course}}/g, courseName)
      .replace(/{{CourseType}}/g, courseName)
      // Price / Course Price
      .replace(/{price}/g, formattedCoursePrice)
      .replace(/{{Price}}/g, formattedCoursePrice)
      .replace(/{{price}}/g, formattedCoursePrice)
      .replace(/{{CoursePrice}}/g, formattedCoursePrice)
      // Total Price / Total Amount
      .replace(/{totalPrice}/g, formattedTotalPrice)
      .replace(/{{TotalPrice}}/g, formattedTotalPrice)
      .replace(/{{totalPrice}}/g, formattedTotalPrice)
      .replace(/{{TotalAmount}}/g, formattedTotalPrice);

    return NextResponse.json({
      success: true,
      order,
      confirmationMessage
    });
  } catch (error: any) {
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء حفظ الطلب' }, { status: 400 });
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

    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'معرف الطلب غير صالح' }, { status: 400 });
    }

    const success = await db.deleteOrder(id);
    if (!success) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف الطلب بنجاح وإرجاع الكود للمخزن' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function normalizePhone(phone: string): string {
  const clean = phone ? phone.trim() : '';
  if (!clean) return '';
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 9) {
    return '07' + digits.slice(-9);
  }
  return clean;
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const body = await req.json();
    const { id, statusId, updates } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });
    }

    if (updates) {
      const finalUpdates: any = { ...updates };
      if (finalUpdates.phone1) finalUpdates.phone1 = normalizePhone(finalUpdates.phone1);
      if (finalUpdates.phone2) finalUpdates.phone2 = normalizePhone(finalUpdates.phone2);
      if (finalUpdates.telegramUsername !== undefined) {
        finalUpdates.telegramUsername = finalUpdates.telegramUsername.trim();
      }
      if (finalUpdates.courseTypeId !== undefined) {
        finalUpdates.courseTypeId = Number(finalUpdates.courseTypeId);
      }
      if (finalUpdates.basePrice !== undefined) {
        finalUpdates.basePrice = Number(finalUpdates.basePrice);
      }
      if (finalUpdates.deliveryFee !== undefined) {
        finalUpdates.deliveryFee = Number(finalUpdates.deliveryFee);
      }
      
      // Auto-recalculate totalPrice if basePrice or deliveryFee changes
      if (finalUpdates.basePrice !== undefined || finalUpdates.deliveryFee !== undefined) {
        const orders = await db.getOrders();
        const currentOrder = orders.find(o => o.id === Number(id));
        const bp = finalUpdates.basePrice !== undefined ? finalUpdates.basePrice : (currentOrder ? currentOrder.basePrice : 250);
        const df = finalUpdates.deliveryFee !== undefined ? finalUpdates.deliveryFee : (currentOrder ? currentOrder.deliveryFee : 0);
        finalUpdates.totalPrice = bp + df;
      } else if (finalUpdates.totalPrice !== undefined) {
        finalUpdates.totalPrice = Number(finalUpdates.totalPrice);
      }

      if (finalUpdates.statusId !== undefined) {
        finalUpdates.statusId = Number(finalUpdates.statusId);
      }

      const updatedOrder = await db.updateOrder(Number(id), finalUpdates);
      return NextResponse.json({ success: true, order: updatedOrder });
    } else if (statusId !== undefined) {
      const updatedOrder = await db.updateOrderStatus(Number(id), Number(statusId));
      return NextResponse.json({ success: true, order: updatedOrder });
    } else {
      return NextResponse.json({ error: 'بيانات التحديث غير صالحة' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
