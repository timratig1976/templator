"use client";

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { EditorProps } from '@monaco-editor/react';

const Editor = dynamic<EditorProps>(() => import('@monaco-editor/react').then(m => m.default as any), { ssr: false });

export type MonacoJsonEditorProps = {
  value: string;
  onChange: (val: string) => void;
  height?: string | number;
  // Validate the document as a JSON Schema against the metaschema (draft-07)
  validateAsJsonSchema?: boolean;
};

const draft07MetaSchema: any = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://json-schema.org/draft-07/schema',
  type: ['object', 'boolean'],
};

export default function MonacoJsonEditor({ value, onChange, height = 400, validateAsJsonSchema }: MonacoJsonEditorProps) {
  const [errors, setErrors] = useState<string[]>([]);

  const ajv = useMemo(() => {
    const a = new Ajv({ allErrors: true } as any);
    try { addFormats(a); } catch {}
    // Add metaschema
    try { a.addMetaSchema(draft07MetaSchema); } catch {}
    return a;
  }, []);

  useEffect(() => {
    if (!validateAsJsonSchema) { setErrors([]); return; }
    try {
      const data = JSON.parse(value);
      const validate = ajv.compile(draft07MetaSchema);
      const valid = validate(data);
      if (!valid) {
        const errs = (validate.errors || []).map(e => `${e.instancePath || e.schemaPath}: ${e.message}`);
        setErrors(errs);
      } else {
        setErrors([]);
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    }
  }, [value, validateAsJsonSchema, ajv]);

  return (
    <div>
      <Editor
        height={typeof height === 'number' ? `${height}px` : height}
        defaultLanguage="json"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          formatOnPaste: true,
          formatOnType: true,
          automaticLayout: true,
        }}
      />
      {errors.length > 0 && (
        <div className="mt-2 p-2 border border-red-200 bg-red-50 text-red-700 rounded text-sm">
          <div className="font-medium mb-1">Schema validation errors</div>
          <ul className="list-disc pl-5">
            {errors.map((e, idx) => (<li key={idx}>{e}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
}
