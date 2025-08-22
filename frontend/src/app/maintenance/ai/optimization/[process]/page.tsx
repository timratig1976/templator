import { redirect } from 'next/navigation';

export default function OptimizationProcessRedirect({ params }: { params: { process: string } }) {
  redirect(`/maintenance/ai/optimization/${encodeURIComponent(params.process)}/editor`);
}
