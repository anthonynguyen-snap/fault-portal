import { redirect } from 'next/navigation';

export default async function NewFaultPage() {
  redirect('/cases/new');
}
