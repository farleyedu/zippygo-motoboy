import { useEffect, useRef, useState } from 'react';

export function useAccountSave() {
  const [saving, setSaving] = useState(false), [failure, setFailure] = useState(''), [success, setSuccess] = useState('');
  const busy = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (action: () => Promise<void | false>, message: string) => {
    if (busy.current) return; busy.current = true; setSaving(true); setFailure(''); setSuccess('');
    try { const result = await action(); if (alive.current && result !== false) setSuccess(message); }
    catch (error) { if (alive.current) setFailure(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  };
  return { saving, failure, success, run, setFailure, clearSuccess: () => setSuccess('') };
}
