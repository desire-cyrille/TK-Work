import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Bailleur,
  ChaineLocation,
  ContratLocation,
  Locataire,
  Logement,
} from "../types/domain";
import {
  loadBiensState,
  saveBiensState,
  type BiensState,
} from "./biensStorage";

function newId() {
  return crypto.randomUUID();
}

type BiensContextValue = BiensState & {
  addBailleur: (p: Omit<Bailleur, "id">) => Bailleur;
  updateBailleur: (id: string, p: Omit<Bailleur, "id">) => void;
  removeBailleur: (id: string) => void;
  addLogement: (l: Omit<Logement, "id">) => Logement;
  updateLogement: (id: string, l: Omit<Logement, "id">) => void;
  addLocataire: (l: Omit<Locataire, "id">) => Locataire;
  updateLocataire: (id: string, l: Omit<Locataire, "id">) => void;
  addContratLocation: (c: Omit<ContratLocation, "id">) => ContratLocation;
  updateContratLocation: (id: string, c: Omit<ContratLocation, "id">) => void;
  removeContratLocation: (id: string) => void;
  addChaineLocation: (
    c: Omit<ChaineLocation, "id">
  ) => ChaineLocation;
  removeLogement: (id: string) => void;
  removeLocataire: (id: string) => void;
  getBailleur: (id: string) => Bailleur | undefined;
  getLogement: (id: string) => Logement | undefined;
  logementsParBailleur: Map<
    string,
    { bailleur: Bailleur; logements: Logement[] }
  >;
};

const BiensContext = createContext<BiensContextValue | null>(null);

export function BiensProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BiensState>(loadBiensState);

  useEffect(() => {
    saveBiensState(state);
  }, [state]);

  const addBailleur = useCallback((data: Omit<Bailleur, "id">) => {
    const bailleur: Bailleur = { ...data, id: newId() };
    setState((s) => ({
      ...s,
      bailleurs: [...s.bailleurs, bailleur],
    }));
    return bailleur;
  }, []);

  const updateBailleur = useCallback((id: string, data: Omit<Bailleur, "id">) => {
    setState((s) => ({
      ...s,
      bailleurs: s.bailleurs.map((p) =>
        p.id === id ? { ...data, id } : p
      ),
    }));
  }, []);

  const removeBailleur = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      bailleurs: s.bailleurs.filter((p) => p.id !== id),
    }));
  }, []);

  const addLogement = useCallback((data: Omit<Logement, "id">) => {
    const logement: Logement = { ...data, id: newId() };
    setState((s) => ({
      ...s,
      logements: [...s.logements, logement],
    }));
    return logement;
  }, []);

  const updateLogement = useCallback((id: string, data: Omit<Logement, "id">) => {
    setState((s) => ({
      ...s,
      logements: s.logements.map((l) =>
        l.id === id ? { ...data, id } : l
      ),
    }));
  }, []);

  const addLocataire = useCallback((data: Omit<Locataire, "id">) => {
    const locataire: Locataire = { ...data, id: newId() };
    setState((s) => ({
      ...s,
      locataires: [...s.locataires, locataire],
    }));
    return locataire;
  }, []);

  const updateLocataire = useCallback((id: string, data: Omit<Locataire, "id">) => {
    setState((s) => ({
      ...s,
      locataires: s.locataires.map((l) =>
        l.id === id ? { ...data, id } : l
      ),
    }));
  }, []);

  const addContratLocation = useCallback((data: Omit<ContratLocation, "id">) => {
    const contrat: ContratLocation = { ...data, id: newId() };
    setState((s) => ({
      ...s,
      contratsLocation: [...s.contratsLocation, contrat],
    }));
    return contrat;
  }, []);

  const updateContratLocation = useCallback(
    (id: string, data: Omit<ContratLocation, "id">) => {
      setState((s) => ({
        ...s,
        contratsLocation: s.contratsLocation.map((c) =>
          c.id === id ? { ...data, id } : c
        ),
      }));
    },
    []
  );

  const removeContratLocation = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      contratsLocation: s.contratsLocation.filter((c) => c.id !== id),
      chainesLocation: s.chainesLocation.filter(
        (ch) =>
          ch.contratPrincipalId !== id && ch.contratSousLocataireId !== id
      ),
    }));
  }, []);

  const addChaineLocation = useCallback((data: Omit<ChaineLocation, "id">) => {
    const chaine: ChaineLocation = { ...data, id: newId() };
    setState((s) => ({
      ...s,
      chainesLocation: [...s.chainesLocation, chaine],
    }));
    return chaine;
  }, []);

  const removeLogement = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      logements: s.logements.filter((l) => l.id !== id),
    }));
  }, []);

  const removeLocataire = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      locataires: s.locataires.filter((l) => l.id !== id),
    }));
  }, []);

  const getBailleur = useCallback(
    (id: string) => state.bailleurs.find((p) => p.id === id),
    [state.bailleurs]
  );

  const getLogement = useCallback(
    (id: string) => state.logements.find((l) => l.id === id),
    [state.logements]
  );

  const logementsParBailleur = useMemo(() => {
    const map = new Map<
      string,
      { bailleur: Bailleur; logements: Logement[] }
    >();

    for (const p of state.bailleurs) {
      map.set(p.id, { bailleur: p, logements: [] });
    }

    for (const l of state.logements) {
      const entry = map.get(l.bailleurId);
      if (entry) {
        entry.logements.push(l);
      } else {
        const orphanKey = `__orphan__${l.bailleurId}`;
        if (!map.has(orphanKey)) {
          map.set(orphanKey, {
            bailleur: {
              id: l.bailleurId,
              typeOccupant: "personne_physique",
              nom: "Bailleur supprimé",
              formeJuridique: "",
              siret: "",
              representantCivilite: "",
              representantPrenom: "",
              representantNom: "",
              email: "",
              telephone: "",
              adresse: "",
              complementAdresse: "",
              codePostal: "",
              ville: "",
            },
            logements: [],
          });
        }
        map.get(orphanKey)!.logements.push(l);
      }
    }

    return map;
  }, [state.bailleurs, state.logements]);

  const value = useMemo(
    () => ({
      ...state,
      addBailleur,
      updateBailleur,
      removeBailleur,
      addLogement,
      updateLogement,
      addLocataire,
      updateLocataire,
      addContratLocation,
      updateContratLocation,
      removeContratLocation,
      addChaineLocation,
      removeLogement,
      removeLocataire,
      getBailleur,
      getLogement,
      logementsParBailleur,
    }),
    [
      state,
      addBailleur,
      updateBailleur,
      removeBailleur,
      addLogement,
      updateLogement,
      addLocataire,
      updateLocataire,
      addContratLocation,
      updateContratLocation,
      removeContratLocation,
      addChaineLocation,
      removeLogement,
      removeLocataire,
      getBailleur,
      getLogement,
      logementsParBailleur,
    ]
  );

  return (
    <BiensContext.Provider value={value}>{children}</BiensContext.Provider>
  );
}

export function useBiens() {
  const ctx = useContext(BiensContext);
  if (!ctx) {
    throw new Error("useBiens must be used within BiensProvider");
  }
  return ctx;
}
