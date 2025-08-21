"use client";

import React, { useMemo, useState } from 'react';
import { useMetricsRegistry, MetricDefinition, MetricProfile } from './useMetricsRegistry';

export default function MetricsRegistry() {
  const { loading, error, definitions, profiles, actions } = useMetricsRegistry();

  // Definition create/edit state
  const [defForm, setDefForm] = useState<Partial<MetricDefinition>>({ key: '', name: '', unit: '', aggregation: 'avg', scope: 'prompt' as any });
  const [defEditId, setDefEditId] = useState<string | null>(null);
  const [defEdit, setDefEdit] = useState<Partial<MetricDefinition>>({});

  // Profile create/edit state
  const [profForm, setProfForm] = useState<{ name: string; description?: string; isActive?: boolean }>({ name: '', description: '', isActive: false });
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const selectedProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId) || null, [profiles, selectedProfileId]);

  const [addItemMetricId, setAddItemMetricId] = useState<string>('');
  const [addItemWeight, setAddItemWeight] = useState<string>('1');
  const [addItemThreshold, setAddItemThreshold] = useState<string>('');

  const usageByMetricId = useMemo(() => {
    const map = new Map<string, { count: number; profiles: MetricProfile[] }>();
    for (const p of profiles) {
      for (const item of p.items) {
        const cur = map.get(item.metricId) || { count: 0, profiles: [] as MetricProfile[] };
        // avoid double counting same profile for same metricId
        if (!cur.profiles.find(pp => pp.id === p.id)) {
          cur.count += 1;
          cur.profiles.push(p);
        }
        map.set(item.metricId, cur);
      }
    }
    return map;
  }, [profiles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Metrics Registry</h1>
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
      </div>
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
      
      {/* Definitions */}
      <div className="bg-white border rounded">
        <div className="p-3 border-b font-medium">Metric Definitions</div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="font-medium mb-2">Create</div>
            <div className="space-y-2">
              <input className="w-full border rounded p-2" placeholder="key (unique)" value={defForm.key || ''} onChange={e => setDefForm(f => ({ ...f, key: e.target.value }))} />
              <input className="w-full border rounded p-2" placeholder="name" value={defForm.name || ''} onChange={e => setDefForm(f => ({ ...f, name: e.target.value }))} />
              <input className="w-full border rounded p-2" placeholder="description" value={defForm.description || ''} onChange={e => setDefForm(f => ({ ...f, description: e.target.value }))} />
              <div className="grid grid-cols-3 gap-2">
                <input className="border rounded p-2" placeholder="unit" value={defForm.unit || ''} onChange={e => setDefForm(f => ({ ...f, unit: e.target.value }))} />
                <select className="border rounded p-2" value={(defForm.aggregation as any) || ''} onChange={e => setDefForm(f => ({ ...f, aggregation: e.target.value as any }))}>
                  <option value="">aggregation</option>
                  <option value="avg">avg</option>
                  <option value="sum">sum</option>
                  <option value="min">min</option>
                  <option value="max">max</option>
                  <option value="latest">latest</option>
                </select>
                <select className="border rounded p-2" value={(defForm.scope as any) || ''} onChange={e => setDefForm(f => ({ ...f, scope: e.target.value as any }))}>
                  <option value="">scope</option>
                  <option value="prompt">prompt</option>
                  <option value="step">step</option>
                  <option value="pipeline">pipeline</option>
                </select>
              </div>
              <input type="number" className="w-full border rounded p-2" placeholder="target (optional number)" value={defForm.target?.toString() || ''} onChange={e => setDefForm(f => ({ ...f, target: e.target.value === '' ? undefined : Number(e.target.value) }))} />
              <button
                className={`px-3 py-2 rounded text-white ${(defForm.key && defForm.name) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
                disabled={!defForm.key || !defForm.name}
                onClick={async () => {
                  await actions.createDefinition({ key: defForm.key!, name: defForm.name!, description: defForm.description, unit: defForm.unit, target: defForm.target, aggregation: defForm.aggregation as any, scope: defForm.scope as any });
                  setDefForm({ key: '', name: '', unit: '', aggregation: 'avg', scope: 'prompt' as any });
                }}
              >Create</button>
            </div>
          </div>

          <div>
            <div className="font-medium mb-2">Existing</div>
            <div className="divide-y border rounded">
              {definitions.map((d) => (
                <div key={d.id} className="p-2">
                  {defEditId === d.id ? (
                    <div className="space-y-2">
                      <input className="w-full border rounded p-2" value={defEdit.name || ''} onChange={e => setDefEdit(v => ({ ...v, name: e.target.value }))} />
                      <input className="w-full border rounded p-2" value={defEdit.description || ''} onChange={e => setDefEdit(v => ({ ...v, description: e.target.value }))} />
                      <div className="grid grid-cols-3 gap-2">
                        <input className="border rounded p-2" value={defEdit.unit || ''} onChange={e => setDefEdit(v => ({ ...v, unit: e.target.value }))} />
                        <select className="border rounded p-2" value={(defEdit.aggregation as any) || ''} onChange={e => setDefEdit(v => ({ ...v, aggregation: e.target.value as any }))}>
                          <option value="">aggregation</option>
                          <option value="avg">avg</option>
                          <option value="sum">sum</option>
                          <option value="min">min</option>
                          <option value="max">max</option>
                          <option value="latest">latest</option>
                        </select>
                        <select className="border rounded p-2" value={(defEdit.scope as any) || ''} onChange={e => setDefEdit(v => ({ ...v, scope: e.target.value as any }))}>
                          <option value="">scope</option>
                          <option value="prompt">prompt</option>
                          <option value="step">step</option>
                          <option value="pipeline">pipeline</option>
                        </select>
                      </div>
                      <input type="number" className="w-full border rounded p-2" value={defEdit.target?.toString() || ''} onChange={e => setDefEdit(v => ({ ...v, target: e.target.value === '' ? undefined : Number(e.target.value) }))} />
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setDefEditId(null)}>Cancel</button>
                        <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={async () => {
                          await actions.updateDefinition(d.id, defEdit);
                          setDefEditId(null);
                        }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{d.key} — {d.name}</div>
                        <div className="text-sm text-gray-500">unit: {d.unit || '-'} | agg: {d.aggregation || '-'} | scope: {d.scope || '-'} | target: {d.target ?? '-'}</div>
                        {d.description && <div className="text-sm text-gray-600 mt-1">{d.description}</div>}
                        <WhereUsed metricId={d.id} usage={usageByMetricId.get(d.id)} />
                      </div>
                      <button className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded" onClick={() => { setDefEditId(d.id); setDefEdit({ name: d.name, description: d.description || '', unit: d.unit || '', aggregation: d.aggregation as any, scope: d.scope as any, target: d.target ?? undefined }); }}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
              {definitions.length === 0 && <div className="p-2 text-gray-500">No definitions</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Profiles */}
      <div className="bg-white border rounded">
        <div className="p-3 border-b font-medium">Metric Profiles</div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="font-medium">Create Profile</div>
            <input className="w-full border rounded p-2" placeholder="name" value={profForm.name} onChange={e => setProfForm(f => ({ ...f, name: e.target.value }))} />
            <input className="w-full border rounded p-2" placeholder="description" value={profForm.description || ''} onChange={e => setProfForm(f => ({ ...f, description: e.target.value }))} />
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!profForm.isActive} onChange={e => setProfForm(f => ({ ...f, isActive: e.target.checked }))} />
              Set Active
            </label>
            <button
              className={`px-3 py-2 rounded text-white ${profForm.name ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
              disabled={!profForm.name}
              onClick={async () => {
                await actions.createProfile({ name: profForm.name, description: profForm.description, isActive: !!profForm.isActive });
                setProfForm({ name: '', description: '', isActive: false });
              }}
            >Create</button>

            <div className="mt-4">
              <div className="font-medium mb-2">Profiles</div>
              <div className="space-y-1">
                {profiles.map(p => (
                  <button key={p.id} className={`w-full text-left px-2 py-1 rounded border ${selectedProfileId === p.id ? 'border-blue-600' : 'border-gray-300'}`} onClick={() => setSelectedProfileId(p.id)}>
                    {p.name} {p.isActive && <span className="text-green-700">(active)</span>}
                  </button>
                ))}
                {profiles.length === 0 && <div className="text-gray-500">No profiles</div>}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {selectedProfile ? (
              <ProfileEditor profile={selectedProfile} onUpdate={async (patch) => actions.updateProfile(selectedProfile.id, patch)} onAddItem={async (input) => actions.addProfileItem(selectedProfile.id, input)} onRemoveItem={actions.removeProfileItem} definitions={definitions} />
            ) : (
              <div className="text-gray-500">Select a profile to edit items</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WhereUsed({ metricId, usage }: { metricId: string; usage?: { count: number; profiles: MetricProfile[] } }) {
  if (!usage || usage.count === 0) {
    return <div className="mt-1 text-xs text-gray-500">Where used: none</div>;
  }
  return (
    <div className="mt-1 text-xs text-gray-700">
      <div className="font-medium">Where used ({usage.count}):</div>
      <ul className="list-disc pl-5">
        {usage.profiles.map(p => (
          <li key={p.id}>{p.name}{p.isActive ? ' (active)' : ''}</li>
        ))}
      </ul>
    </div>
  );
}

function ProfileEditor({ profile, onUpdate, onAddItem, onRemoveItem, definitions }: {
  profile: MetricProfile,
  onUpdate: (patch: { name?: string; description?: string; isActive?: boolean }) => Promise<void>,
  onAddItem: (input: { metricId: string; weight?: number; threshold?: number; config?: any }) => Promise<void>,
  onRemoveItem: (itemId: string) => Promise<void>,
  definitions: MetricDefinition[],
}) {
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description || '');
  const [isActive, setIsActive] = useState(profile.isActive);

  const [metricId, setMetricId] = useState('');
  const [weight, setWeight] = useState('1');
  const [threshold, setThreshold] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Edit Profile</div>
        <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={async () => { await onUpdate({ name, description, isActive }); }}>Save</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="border rounded p-2" value={name} onChange={e => setName(e.target.value)} />
        <input className="border rounded p-2" value={description} onChange={e => setDescription(e.target.value)} />
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          Active
        </label>
      </div>

      <div className="mt-2">
        <div className="font-medium mb-2">Items</div>
        <div className="space-y-2">
          {profile.items.map(it => (
            <div key={it.id} className="p-2 border rounded flex items-center justify-between">
              <div>
                <div className="font-medium">{it.metric?.key || it.metricId} — {it.metric?.name}</div>
                <div className="text-sm text-gray-500">weight: {it.weight ?? '-'} | threshold: {it.threshold ?? '-'}</div>
              </div>
              <button className="px-2 py-1 text-sm rounded bg-red-600 text-white" onClick={() => onRemoveItem(it.id)}>Remove</button>
            </div>
          ))}
          {profile.items.length === 0 && <div className="text-gray-500">No items</div>}
        </div>

        <div className="mt-3 p-3 border rounded">
          <div className="font-medium mb-2">Add Item</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select className="border rounded p-2" value={metricId} onChange={e => setMetricId(e.target.value)}>
              <option value="">select metric</option>
              {definitions.map(d => (
                <option key={d.id} value={d.id}>{d.key} — {d.name}</option>
              ))}
            </select>
            <input className="border rounded p-2" type="number" placeholder="weight" value={weight} onChange={e => setWeight(e.target.value)} />
            <input className="border rounded p-2" type="number" placeholder="threshold" value={threshold} onChange={e => setThreshold(e.target.value)} />
            <button
              className={`px-3 py-2 rounded text-white ${metricId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
              disabled={!metricId}
              onClick={async () => {
                await onAddItem({ metricId, weight: weight === '' ? undefined : Number(weight), threshold: threshold === '' ? undefined : Number(threshold) });
                setMetricId(''); setWeight('1'); setThreshold('');
              }}
            >Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
