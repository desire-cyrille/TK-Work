import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TextProofreadDialog } from "../components/TextProofreadDialog";

type Ctx = { openProofreadDialog: () => void };

const ProofreadContext = createContext<Ctx | null>(null);

export function ProofreadDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openProofreadDialog = useCallback(() => setOpen(true), []);

  const value = useMemo(
    () => ({ openProofreadDialog }),
    [openProofreadDialog],
  );

  return (
    <ProofreadContext.Provider value={value}>
      {children}
      <TextProofreadDialog open={open} onClose={() => setOpen(false)} />
    </ProofreadContext.Provider>
  );
}

export function useProofreadDialog(): Ctx {
  const c = useContext(ProofreadContext);
  if (!c) {
    throw new Error("useProofreadDialog doit être utilisé dans ProofreadDialogProvider");
  }
  return c;
}
