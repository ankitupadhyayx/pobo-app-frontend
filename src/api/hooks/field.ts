import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api } from '../instance';
import { queryClient } from '../queryClient';
import type { components } from '../schema';

type S = components['schemas'];
export type MappingSociety = S['MappingSociety'];
export type SocietyDetail = S['MappingSocietyDetail'];
export type TowerSummary = S['TowerSummary'];
export type TowerDetail = S['TowerDetail'];
export type UnitStatus = S['UnitStatus'];
export type UnitDetail = S['UnitDetail'];
export type UnitContact = S['UnitContact'];
export type Survey = S['Survey'];
export type FieldTask = S['FieldTask'];
export type Opportunity = S['Opportunity'];
export type Progress = S['Progress'];

export const fk = {
  societies: ['mapping', 'societies'] as const,
  society: (id: string) => ['mapping', 'society', id] as const,
  tower: (id: string) => ['mapping', 'tower', id] as const,
  unit: (id: string) => ['unit', id] as const,
  surveys: (id: string) => ['unit', id, 'surveys'] as const,
  tasks: ['fieldTasks'] as const,
  opportunities: ['opportunities'] as const,
  corrections: ['corrections'] as const,
};

/** Refresh the grid/progress after a structure or survey change. */
export function invalidateField(opts: { unitId?: string; towerId?: string; societyId?: string } = {}) {
  void queryClient.invalidateQueries({ queryKey: fk.societies });
  if (opts.societyId) void queryClient.invalidateQueries({ queryKey: fk.society(opts.societyId) });
  if (opts.towerId) void queryClient.invalidateQueries({ queryKey: fk.tower(opts.towerId) });
  else void queryClient.invalidateQueries({ queryKey: ['mapping', 'tower'] });
  if (opts.unitId) void queryClient.invalidateQueries({ queryKey: fk.unit(opts.unitId) });
  void queryClient.invalidateQueries({ queryKey: fk.tasks });
}

// ------------------------------------------------------------- mapping (APP-21/22)
export function useMappingSocieties() {
  return useQuery({ queryKey: fk.societies, queryFn: () => unwrap(api.GET('/api/v1/mapping/societies')) });
}

export function useMappingSociety(id: string) {
  return useQuery({ queryKey: fk.society(id), enabled: !!id, queryFn: () => unwrap(api.GET('/api/v1/mapping/societies/{id}', { params: { path: { id } } })) });
}

export function useTower(id: string) {
  return useQuery({ queryKey: fk.tower(id), enabled: !!id, queryFn: () => unwrap(api.GET('/api/v1/mapping/towers/{id}', { params: { path: { id } } })) });
}

export function useAddTower(societyId: string) {
  return useMutation({
    mutationFn: (body: S['TowerInputRequest']) => unwrap(api.POST('/api/v1/mapping/societies/{id}/towers', { params: { path: { id: societyId } }, body })),
    onSuccess: () => invalidateField({ societyId }),
  });
}

export function useGenerate(towerId: string) {
  return useMutation({
    mutationFn: (body: S['GenerateInputRequest']) => unwrap(api.POST('/api/v1/mapping/towers/{id}/generate', { params: { path: { id: towerId } }, body })),
    onSuccess: (r) => {
      queryClient.setQueryData(fk.tower(towerId), r.tower);
      invalidateField({ towerId, societyId: r.tower.society_id });
    },
  });
}

export function useAddUnit(towerId: string) {
  return useMutation({
    mutationFn: (body: S['UnitInputRequest']) => unwrap(api.POST('/api/v1/mapping/towers/{id}/units', { params: { path: { id: towerId } }, body })),
    onSuccess: () => invalidateField({ towerId }),
  });
}

export function useEditUnit(towerId: string) {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: S['PatchedUnitUpdateRequest'] }) => unwrap(api.PATCH('/api/v1/units/{id}', { params: { path: { id } }, body })),
    onSuccess: (_r, v) => invalidateField({ towerId, unitId: v.id }),
  });
}

export function useDeleteUnit(towerId: string) {
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await api.DELETE('/api/v1/units/{id}', { params: { path: { id } } });
      if (!r.response.ok) await unwrap(Promise.resolve(r));
    },
    onSuccess: () => invalidateField({ towerId }),
  });
}

export function useRequestCorrection() {
  return useMutation({
    mutationFn: (body: S['CorrectionInputRequest']) => unwrap(api.POST('/api/v1/mapping/corrections', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: fk.corrections }),
  });
}

export function useCorrections() {
  return useQuery({ queryKey: fk.corrections, queryFn: () => unwrap(api.GET('/api/v1/mapping/corrections')) });
}

// ------------------------------------------------------------- units & surveys (APP-23)
export function useUnit(id: string) {
  return useQuery({ queryKey: fk.unit(id), enabled: !!id, queryFn: () => unwrap(api.GET('/api/v1/units/{id}', { params: { path: { id } } })) });
}

export function useSurveyHistory(id: string, enabled = true) {
  return useQuery({ queryKey: fk.surveys(id), enabled: !!id && enabled, queryFn: () => unwrap(api.GET('/api/v1/units/{id}/surveys', { params: { path: { id } } })) });
}

// ------------------------------------------------------------- opportunities & field tasks (APP-23/27)
export function useOpportunities() {
  return useQuery({ queryKey: fk.opportunities, queryFn: async () => (await unwrap(api.GET('/api/v1/opportunities', { params: { query: { page_size: 100 } } }))).results });
}

export function useConvertOpportunity() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: S['ConvertInputRequest'] }) => unwrap(api.POST('/api/v1/opportunities/{id}/convert-to-lead', { params: { path: { id } }, body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fk.opportunities });
      void queryClient.invalidateQueries({ queryKey: ['unit'] });
      void queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });
}

export function useFieldTasks(status: 'OPEN' | 'DONE' = 'OPEN') {
  return useQuery({ queryKey: [...fk.tasks, status], queryFn: () => unwrap(api.GET('/api/v1/me/field-tasks', { params: { query: { status } } })) });
}

export function useCompleteFieldTask() {
  return useMutation({
    mutationFn: ({ id, notes, dismiss }: { id: string; notes?: string; dismiss: boolean }) =>
      unwrap(api.POST('/api/v1/field-tasks/{id}/complete', { params: { path: { id } }, body: { notes, dismiss } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fk.tasks });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
