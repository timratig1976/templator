import { redirect } from 'next/navigation';

export default function OptimizationLogsRedirect({ params }: { params: { process: string } }) {
  redirect(`/maintenance/ai/optimization/${encodeURIComponent(params.process)}/editor`);
}
