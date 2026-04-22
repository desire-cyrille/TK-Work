import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { GateLayout } from "./components/GateLayout";
import {
  LegacyLocataireModifierRedirect,
  LegacyLogementModifierRedirect,
} from "./components/LegacyPathRedirects";
import { BiensSectionLockLayout } from "./components/BiensSectionLockLayout";
import { Layout } from "./components/Layout";
import { ModuleShell } from "./components/ModuleShell";
import { RedirectIfAuthed } from "./components/RedirectIfAuthed";
import { RequireAdmin } from "./components/RequireAdmin";
import { RequireAuth } from "./components/RequireAuth";
import { Bailleurs } from "./pages/Bailleurs";
import { Connexion } from "./pages/Connexion";
import { Home } from "./pages/Home";
import { Locataires } from "./pages/Locataires";
import { Logements } from "./pages/Logements";
import { NouveauLocataire } from "./pages/NouveauLocataire";
import { EditionLogement } from "./pages/EditionLogement";
import { NouveauLogement } from "./pages/NouveauLogement";
import { Locations } from "./pages/Locations";
import { Airbnb } from "./pages/Airbnb";
import { Reglages } from "./pages/Reglages";
import { Finance } from "./pages/Finance";
import { PageFonctions } from "./pages/PageFonctions";
import { AdminUtilisateurs } from "./pages/AdminUtilisateurs";
import { DevisEditeur } from "./pages/DevisEditeur";
import { DevisListe } from "./pages/DevisListe";
import { DevisParametresGlobaux } from "./pages/DevisParametresGlobaux";
import { MustChangePassword } from "./pages/MustChangePassword";
import { RapportActiviteAccueil } from "./pages/RapportActiviteAccueil";
import { RapportActiviteNouveauProjet } from "./pages/RapportActiviteNouveauProjet";
import { RapportActiviteProjetDetail } from "./pages/RapportActiviteProjetDetail";

export default function App() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthed />}>
        <Route path="/connexion" element={<Connexion />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/changement-mot-de-passe" element={<MustChangePassword />} />

        <Route element={<RequireAdmin />}>
          <Route path="/admin/utilisateurs" element={<AdminUtilisateurs />} />
        </Route>

        <Route path="/logement" element={<Navigate to="/biens/logement" replace />} />
        <Route
          path="/logement/nouveau"
          element={<Navigate to="/biens/logement/nouveau" replace />}
        />
        <Route
          path="/logement/:id/modifier"
          element={<LegacyLogementModifierRedirect />}
        />
        <Route path="/locataire" element={<Navigate to="/biens/locataire" replace />} />
        <Route
          path="/locataire/nouveau"
          element={<Navigate to="/biens/locataire/nouveau" replace />}
        />
        <Route
          path="/locataire/:id/modifier"
          element={<LegacyLocataireModifierRedirect />}
        />
        <Route path="/bailleur" element={<Navigate to="/biens/bailleur" replace />} />
        <Route path="/location" element={<Navigate to="/biens/location" replace />} />
        <Route path="/airbnb" element={<Navigate to="/biens/airbnb" replace />} />
        <Route path="/finance" element={<Navigate to="/biens/finance" replace />} />
        <Route path="/reglages" element={<Navigate to="/biens/reglages" replace />} />
        <Route
          path="/proprietaire"
          element={<Navigate to="/biens/bailleur" replace />}
        />

        <Route
          path="/fonctions"
          element={
            <GateLayout>
              <PageFonctions />
            </GateLayout>
          }
        />

        <Route path="/biens" element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            element={
              <BiensSectionLockLayout
                resourceKey="biens:immobilier"
                sectionLabel="Immobilier"
              />
            }
          >
            <Route path="logement" element={<Logements />} />
            <Route path="logement/nouveau" element={<NouveauLogement />} />
            <Route path="logement/:id/modifier" element={<EditionLogement />} />
            <Route path="locataire" element={<Locataires />} />
            <Route path="locataire/nouveau" element={<NouveauLocataire />} />
            <Route path="locataire/:id/modifier" element={<NouveauLocataire />} />
            <Route path="bailleur" element={<Bailleurs />} />
            <Route
              path="proprietaire"
              element={<Navigate to="/biens/bailleur" replace />}
            />
            <Route path="finance" element={<Finance />} />
          </Route>
          <Route path="location" element={<Locations />} />
          <Route
            element={
              <BiensSectionLockLayout
                resourceKey="biens:airbnb"
                sectionLabel="Airbnb"
              />
            }
          >
            <Route path="airbnb" element={<Airbnb />} />
          </Route>
          <Route
            element={
              <BiensSectionLockLayout
                resourceKey="biens:reglages"
                sectionLabel="Réglages"
              />
            }
          >
            <Route path="reglages" element={<Reglages />} />
          </Route>
          <Route path="*" element={<Navigate to="/biens" replace />} />
        </Route>

        <Route element={<ModuleShell />}>
          <Route path="devis" element={<Outlet />}>
            <Route index element={<DevisListe />} />
            <Route path="parametres" element={<DevisParametresGlobaux />} />
            <Route path="edition/:id" element={<DevisEditeur />} />
          </Route>
          <Route path="rapport-activite" element={<Outlet />}>
            <Route index element={<Navigate to="accueil" replace />} />
            <Route path="accueil" element={<RapportActiviteAccueil />} />
            <Route path="projet/nouveau" element={<RapportActiviteNouveauProjet />} />
            <Route path="projet/:id" element={<RapportActiviteProjetDetail />} />
          </Route>
        </Route>

        <Route index element={<Navigate to="/fonctions" replace />} />
        <Route path="*" element={<Navigate to="/fonctions" replace />} />
      </Route>
    </Routes>
  );
}
