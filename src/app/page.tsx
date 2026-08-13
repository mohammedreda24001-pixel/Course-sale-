import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/lib/auth';

export default async function IndexPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  
  if (session) {
    const user = await verifySessionToken(session.value);
    if (user) {
      redirect('/dashboard/add-order');
    }
  }
  
  redirect('/login');
}
