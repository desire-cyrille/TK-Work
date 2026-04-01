import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ContratLocation } from "../types/domain";
import { useBiens } from "./BiensContext";
import {
  loadFinanceState,
  saveFinanceState,
  type FinanceAppState,
  type LigneFraisMois,
  type LignePaiementMois,
  type MoisFinanceContrat,
} from "./financeStorage";
import { fusionnerMoisFinanceAvecContrat } from "../lib/moisFinance";

function newId() {
  return crypto.randomUUID();
}

type FinanceContextValue = FinanceAppState & {
  listerMoisContrat: (c: ContratLocation) => MoisFinanceContrat[];
  /**
   * Réaligne les mois enregistrés sur le contrat (nouvelles dates, loyers…)
   * tout en conservant paiements / frais / observations par moisCle.
   */
  resynchroniserMoisContrat: (c: ContratLocation) => void;
  upsertMoisRow: (contratId: string, row: MoisFinanceContrat) => void;
  addPaiementMois: (
    contratId: string,
    moisCle: string,
    ligne: Omit<LignePaiementMois, "id">
  ) => void;
  addFraisMois: (
    contratId: string,
    moisCle: string,
    ligne: Omit<LigneFraisMois, "id">
  ) => void;
  removePaiementMois: (
    contratId: string,
    moisCle: string,
    paiementId: string
  ) => void;
  removeFraisMois: (
    contratId: string,
    moisCle: string,
    fraisId: string
  ) => void;
  setTypesFraisListe: (types: string[]) => void;
  addTypeFrais: (libelle: string) => void;
  removeTypeFrais: (libelle: string) => void;
  setLocataireReferenceBeneficeId: (id: string) => void;
};

const FinanceCtx = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { contratsLocation } = useBiens();
  const [state, setState] = useState<FinanceAppState>(loadFinanceState);

  useEffect(() => {
    saveFinanceState(state);
  }, [state]);

  useEffect(() => {
    const idsActifs = new Set(contratsLocation.map((c) => c.id));
    setState((s) => {
      const nextMpc = { ...s.moisParContrat };
      let changed = false;
      for (const k of Object.keys(nextMpc)) {
        if (!idsActifs.has(k)) {
          delete nextMpc[k];
          changed = true;
        }
      }
      return changed ? { ...s, moisParContrat: nextMpc } : s;
    });
  }, [contratsLocation]);

  const listerMoisContrat = useCallback(
    (c: ContratLocation) =>
      fusionnerMoisFinanceAvecContrat(c, state.moisParContrat[c.id] ?? []),
    [state.moisParContrat]
  );

  const resynchroniserMoisContrat = useCallback((c: ContratLocation) => {
    setState((s) => ({
      ...s,
      moisParContrat: {
        ...s.moisParContrat,
        [c.id]: fusionnerMoisFinanceAvecContrat(
          c,
          s.moisParContrat[c.id] ?? []
        ),
      },
    }));
  }, []);

  const upsertMoisRow = useCallback((contratId: string, row: MoisFinanceContrat) => {
    setState((s) => {
      const arr = [...(s.moisParContrat[contratId] ?? [])];
      const i = arr.findIndex((x) => x.moisCle === row.moisCle);
      if (i >= 0) arr[i] = row;
      else arr.push(row);
      arr.sort((a, b) => a.moisCle.localeCompare(b.moisCle));
      return {
        ...s,
        moisParContrat: { ...s.moisParContrat, [contratId]: arr },
      };
    });
  }, []);

  const patchMois = useCallback(
    (
      contratId: string,
      moisCle: string,
      fn: (cur: MoisFinanceContrat) => MoisFinanceContrat
    ) => {
      const contrat = contratsLocation.find((c) => c.id === contratId);
      if (!contrat) return;
      const liste = fusionnerMoisFinanceAvecContrat(
        contrat,
        state.moisParContrat[contratId] ?? []
      );
      const cur = liste.find((m) => m.moisCle === moisCle);
      if (!cur) return;
      upsertMoisRow(contratId, fn(cur));
    },
    [contratsLocation, state.moisParContrat, upsertMoisRow]
  );

  const addPaiementMois = useCallback(
    (
      contratId: string,
      moisCle: string,
      ligne: Omit<LignePaiementMois, "id">
    ) => {
      patchMois(contratId, moisCle, (cur) => ({
        ...cur,
        paiements: [...cur.paiements, { ...ligne, id: newId() }],
      }));
    },
    [patchMois]
  );

  const addFraisMois = useCallback(
    (contratId: string, moisCle: string, ligne: Omit<LigneFraisMois, "id">) => {
      patchMois(contratId, moisCle, (cur) => ({
        ...cur,
        frais: [...cur.frais, { ...ligne, id: newId() }],
      }));
    },
    [patchMois]
  );

  const removePaiementMois = useCallback(
    (contratId: string, moisCle: string, paiementId: string) => {
      patchMois(contratId, moisCle, (cur) => ({
        ...cur,
        paiements: cur.paiements.filter((p) => p.id !== paiementId),
      }));
    },
    [patchMois]
  );

  const removeFraisMois = useCallback(
    (contratId: string, moisCle: string, fraisId: string) => {
      patchMois(contratId, moisCle, (cur) => ({
        ...cur,
        frais: cur.frais.filter((f) => f.id !== fraisId),
      }));
    },
    [patchMois]
  );

  const setTypesFraisListe = useCallback((types: string[]) => {
    setState((s) => ({ ...s, typesFrais: types.map((t) => t.trim()).filter(Boolean) }));
  }, []);

  const addTypeFrais = useCallback((libelle: string) => {
    const t = libelle.trim();
    if (!t) return;
    setState((s) =>
      s.typesFrais.includes(t)
        ? s
        : { ...s, typesFrais: [...s.typesFrais, t] }
    );
  }, []);

  const removeTypeFrais = useCallback((libelle: string) => {
    setState((s) => ({
      ...s,
      typesFrais: s.typesFrais.filter((x) => x !== libelle),
    }));
  }, []);

  const setLocataireReferenceBeneficeId = useCallback((id: string) => {
    setState((s) => ({ ...s, locataireReferenceBeneficeId: id }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      listerMoisContrat,
      resynchroniserMoisContrat,
      upsertMoisRow,
      addPaiementMois,
      addFraisMois,
      removePaiementMois,
      removeFraisMois,
      setTypesFraisListe,
      addTypeFrais,
      removeTypeFrais,
      setLocataireReferenceBeneficeId,
    }),
    [
      state,
      listerMoisContrat,
      resynchroniserMoisContrat,
      upsertMoisRow,
      addPaiementMois,
      addFraisMois,
      removePaiementMois,
      removeFraisMois,
      setTypesFraisListe,
      addTypeFrais,
      removeTypeFrais,
      setLocataireReferenceBeneficeId,
    ]
  );

  return <FinanceCtx.Provider value={value}>{children}</FinanceCtx.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceCtx);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
