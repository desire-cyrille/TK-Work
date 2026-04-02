import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { useAuth } from "../context/AuthContext";
import { getAuthToken } from "../lib/authToken";
import styles from "./AdminUtilisateurs.module.css";

type UserRow = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
  createdAt: string;
};

export function AdminUtilisateurs() {
  const { profileEmail } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");

  const load = useCallback(async () => {
    setMsg(null);
    const tok = getAuthToken();
    if (!tok) return;
    const r = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${tok}` },
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as {
      users?: UserRow[];
      error?: string;
    };
    if (!r.ok) {
      setMsg({ type: "err", text: data.error ?? `Erreur ${r.status}` });
      return;
    }
    if (!Array.isArray(data.users)) {
      setMsg({ type: "err", text: "Réponse invalide." });
      return;
    }
    setUsers(data.users);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const tok = getAuthToken();
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: newEmail.trim(),
        provisionalPassword: newPwd,
        role: newRole,
      }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r.ok) {
      setMsg({ type: "err", text: data.error ?? `Erreur ${r.status}` });
      return;
    }
    setMsg({
      type: "ok",
      text: "Compte créé. L’utilisateur devra choisir un mot de passe personnel à la première connexion.",
    });
    setNewEmail("");
    setNewPwd("");
    setNewRole("USER");
    void load();
  }

  async function setProvisional(userId: string, pwd: string) {
    const tok = getAuthToken();
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: userId, provisionalPassword: pwd }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      setMsg({ type: "err", text: data.error ?? `Erreur ${r.status}` });
      return;
    }
    setMsg({
      type: "ok",
      text: "Mot de passe provisoire défini. L’utilisateur devra le changer à la connexion.",
    });
    void load();
  }

  async function setRole(userId: string, role: "USER" | "ADMIN") {
    const tok = getAuthToken();
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: userId, role }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      setMsg({ type: "err", text: data.error ?? `Erreur ${r.status}` });
      return;
    }
    setMsg({ type: "ok", text: "Rôle mis à jour." });
    void load();
  }

  async function removeUser(userId: string, email: string) {
    if (!confirm(`Supprimer définitivement le compte ${email} ?`)) return;
    const tok = getAuthToken();
    const r = await fetch(
      `/api/admin/users?id=${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok}` },
        cache: "no-store",
      },
    );
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      setMsg({ type: "err", text: data.error ?? `Erreur ${r.status}` });
      return;
    }
    setMsg({ type: "ok", text: "Compte supprimé." });
    void load();
  }

  return (
    <PageFrame
      title="Administration — profils utilisateurs"
      actions={
        <button
          type="button"
          className={frameStyles.headerCtaSecondary}
          onClick={() => void load()}
          disabled={busy}
        >
          Actualiser
        </button>
      }
    >
      <div className={styles.page}>
        <p className={styles.intro}>
          Création des comptes, mots de passe provisoires et rôles. Vous êtes connecté
          en tant que <strong>{profileEmail}</strong>. Les données métier (biens,
          devis, rapports) sont <strong>partagées</strong> entre tous les comptes
          après synchronisation (page <strong>Fonctions</strong> → Nuage).
        </p>

        {msg ? (
          <p
            className={msg.type === "err" ? styles.bannerErr : styles.bannerOk}
            role="status"
          >
            {msg.text}
          </p>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Nouveau compte</h2>
          <form className={styles.form} onSubmit={(e) => void onCreate(e)}>
            <label className={styles.label}>
              E-mail
              <input
                className={styles.input}
                type="email"
                autoComplete="off"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </label>
            <label className={styles.label}>
              Mot de passe provisoire (8 caractères min.)
              <input
                className={styles.input}
                type="password"
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className={styles.label}>
              Rôle
              <select
                className={styles.input}
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value === "ADMIN" ? "ADMIN" : "USER")
                }
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </label>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>
              Créer le profil
            </button>
          </form>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Comptes existants</h2>
          {users.length === 0 ? (
            <p className={styles.empty}>Aucun compte (ou chargement en cours).</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Rôle</th>
                    <th>Mot de passe</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRowEditor
                      key={u.id}
                      row={u}
                      currentEmail={profileEmail}
                      onSetRole={setRole}
                      onSetProvisional={setProvisional}
                      onDelete={removeUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  );
}

function UserRowEditor({
  row,
  currentEmail,
  onSetRole,
  onSetProvisional,
  onDelete,
}: {
  row: UserRow;
  currentEmail: string;
  onSetRole: (id: string, role: "USER" | "ADMIN") => void;
  onSetProvisional: (id: string, pwd: string) => void;
  onDelete: (id: string, email: string) => void;
}) {
  const [pwdDraft, setPwdDraft] = useState("");

  const isSelf = row.email === currentEmail;

  return (
    <tr>
      <td>{row.email}</td>
      <td>
        <select
          className={styles.inputInline}
          value={row.role}
          onChange={(e) =>
            void onSetRole(
              row.id,
              e.target.value === "ADMIN" ? "ADMIN" : "USER",
            )
          }
        >
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Administrateur</option>
        </select>
      </td>
      <td>
        {row.mustChangePassword ? (
          <span className={styles.tag}>Provisoire</span>
        ) : (
          <span className={styles.tagOk}>À jour</span>
        )}
        <div className={styles.pwdRow}>
          <input
            className={styles.inputInline}
            type="password"
            placeholder="Nouveau provisoire"
            value={pwdDraft}
            onChange={(e) => setPwdDraft(e.target.value)}
          />
          <button
            type="button"
            className={styles.btnSmall}
            onClick={() => {
              if (pwdDraft.length < 8) {
                alert("8 caractères minimum.");
                return;
              }
              void onSetProvisional(row.id, pwdDraft);
              setPwdDraft("");
            }}
          >
            Appliquer
          </button>
        </div>
      </td>
      <td className={styles.actions}>
        <button
          type="button"
          className={styles.btnDanger}
          disabled={isSelf}
          onClick={() => onDelete(row.id, row.email)}
        >
          Supprimer
        </button>
      </td>
    </tr>
  );
}
