import DynamicFlowRunner from "../../../../components/flow/DynamicFlowRunner";

export default function FlowRunnerPage({ params }: { params: { flowId: string } }) {
  const { flowId } = params;
  return (
    <div className="max-w-4xl mx-auto py-6">
      <DynamicFlowRunner flowId={flowId} />
    </div>
  );
}
