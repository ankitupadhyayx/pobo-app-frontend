import { useState } from 'react';
import { View } from 'react-native';
import { Send } from 'lucide-react-native';
import { Button, InlineBanner, TextField } from '@/components/ui';
import { useAddNote } from '@/api/hooks/leads';
import { errorMessage } from '@/api/errors';
import { useT } from '@/i18n';

export function NoteComposer({ relationshipId, onDone }: { relationshipId: string; onDone: () => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string>();
  const add = useAddNote(relationshipId);
  return (
    <View className="gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <TextField testID="note-input" label={t('lead.addNote')} placeholder={t('lead.notePlaceholder')} value={text} onChangeText={(v) => { setText(v); setErr(undefined); }} multiline error={err ?? (add.error as { fields?: Record<string, string> })?.fields?.text} />
      {add.error && !(add.error as { fields?: Record<string, string> }).fields?.text ? <InlineBanner>{errorMessage(add.error)}</InlineBanner> : null}
      <View className="flex-row justify-end gap-2">
        <Button size="sm" variant="secondary" label={t('common.cancel')} onPress={onDone} />
        <Button
          testID="note-save"
          size="sm"
          icon={Send}
          label={t('lead.saveNote')}
          loading={add.isPending}
          onPress={() => {
            if (!text.trim()) return setErr(t('errors.required'));
            add.mutate(text.trim(), { onSuccess: () => { setText(''); onDone(); } });
          }}
        />
      </View>
    </View>
  );
}
