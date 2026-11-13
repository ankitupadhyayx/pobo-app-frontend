import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, View, type HostInstance, type ScrollViewInstance, type ScrollViewProps } from 'react-native';
import { useActions } from '@/state/actions';
import { useT } from '@/i18n';


/**
 * R2-8: when Save fails, say so straight away, scroll to the first invalid field and keep its
 * error under it (fields already turn red when they get an `error`).
 *
 *   const form = useFormFocus();
 *   <FormScrollView form={form} innerClassName="gap-4">
 *     <FieldAnchor form={form} name="phone"><TextField … error={errs.phone} /></FieldAnchor>
 *   </FormScrollView>
 *   if (Object.keys(errs).length) return form.fail(errs);
 *
 * Inside a BottomSheet pass `form` to the sheet; it owns the ScrollView and shows `form.notice`
 * pinned under its title (a toast under a Modal would be hidden). Full screens get a toast too.
 */
/** Holds the scroll view, its content view and the field anchors (plain object, not React refs). */
class FormRegistry {
  scroll: ScrollViewInstance | null = null;
  content: HostInstance | null = null;
  anchors = new Map<string, HostInstance>();
  private cbs = new Map<string, (el: HostInstance | null) => void>();
  private readonly onScroll = (el: ScrollViewInstance | null) => {
    this.scroll = el;
  };
  private readonly onContent = (el: HostInstance | null) => {
    this.content = el;
  };
  /** Callback refs for the ScrollView and its content View (getters keep the lint happy). */
  readonly scrollTarget = () => this.onScroll;
  readonly contentTarget = () => this.onContent;
  /** Stable callback ref per name. "budgetMin|budgetMax": one anchor for several error keys. */
  readonly anchor = (name: string) => {
    let cb = this.cbs.get(name);
    if (!cb) {
      cb = (el: HostInstance | null) => {
        for (const n of name.split('|')) {
          if (el) this.anchors.set(n, el);
          else this.anchors.delete(n);
        }
      };
      this.cbs.set(name, cb);
    }
    return cb;
  };

  /** Scroll to the topmost anchor among `names`. */
  scrollToFirst(names: string[]) {
    const { content, scroll } = this;
    const els = names.map((n) => [n, this.anchors.get(n)] as const).filter((x): x is readonly [string, HostInstance] => !!x[1]);
    if (!els.length || !scroll) return null;
    let best: { name: string; y: number } | null = null;
    let pending = els.length;
    const done = () => {
      if (--pending > 0) return;
      const target = best ?? { name: els[0][0], y: 0 };
      try {
        scroll.scrollTo({ y: Math.max(0, target.y - 24), animated: true });
      } catch {
        /* not mounted */
      }
    };
    for (const [name, el] of els) {
      try {
        if (!content || typeof el.measureLayout !== 'function') throw new Error('no layout');
        el.measureLayout(
          content,
          (_x: number, y: number) => {
            if (!best || y < best.y) best = { name, y };
            done();
          },
          () => done(),
        );
      } catch {
        done();
      }
    }
    return els[0][0];
  }
}

export function useFormFocus(opts: { toast?: boolean } = {}) {
  const t = useT();
  const showError = useActions((s) => s.showError);
  const [reg] = useState(() => new FormRegistry());
  const [notice, setNotice] = useState<string | null>(null);
  const withToast = opts.toast !== false;

  /** Call with the error map (keys = anchor names). Returns false so `return form.fail(e)` reads well. */
  const fail = useCallback(
    (errors: Record<string, string | undefined | null>, message?: string) => {
      const names = Object.keys(errors).filter((k) => !!errors[k]);
      const count = names.length;
      const msg = message ?? (count > 1 ? t('form.fixMany', { count }) : t('form.fixOne'));
      setNotice(msg);
      if (withToast) showError(msg);
      reg.scrollToFirst(names.length ? names : [...reg.anchors.keys()]);
      return false;
    },
    [withToast, reg, showError, t],
  );

  const clear = useCallback(() => setNotice(null), []);
  return { scrollTarget: reg.scrollTarget, contentTarget: reg.contentTarget, anchor: reg.anchor, fail, clear, notice };
}

export type FormFocus = ReturnType<typeof useFormFocus>;

/** Wraps one field so `form.fail` can scroll to it. */
export function FieldAnchor({ form, name, children }: { form: FormFocus; name: string; children: ReactNode }) {
  return (
    <View ref={form.anchor(name)} collapsable={false} testID={`anchor-${name.split('|')[0]}`}>
      {children}
    </View>
  );
}

/** ScrollView wired to `form` (R2-8). `innerClassName` is the gap/layout of the content. */
export function FormScrollView({ form, innerClassName, children, ...rest }: ScrollViewProps & { form: FormFocus; innerClassName?: string }) {
  return (
    <ScrollView ref={form.scrollTarget()} {...rest}>
      <View ref={form.contentTarget()} collapsable={false} className={innerClassName}>
        {children}
      </View>
    </ScrollView>
  );
}
