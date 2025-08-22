import { redirect } from 'next/navigation';

export default function OptimizationDashboardRedirect({ params }: { params: { process: string } }) {
  redirect(`/maintenance/ai/optimization/${encodeURIComponent(params.process)}/editor`);
}
