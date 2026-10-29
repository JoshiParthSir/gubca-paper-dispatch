import { Link } from 'react-router-dom';
import { LegalDocument, type LegalSection } from '@/components/public/LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'summary',
    title: 'Summary',
    body: (
      <p>
        Paper Dispatch uses only what it needs to work: one preference cookie and a little browser storage to keep
        you signed in. There are <strong>no analytics, advertising or tracking cookies</strong>, so there is nothing
        to opt out of.
      </p>
    ),
  },
  {
    id: 'what',
    title: 'What cookies and browser storage are',
    body: (
      <p>
        Cookies are small text files a website saves in your browser. Local storage and session storage are similar
        browser features that let a site remember information between pages or visits. This policy covers all three.
      </p>
    ),
  },
  {
    id: 'list',
    title: 'What we use',
    body: (
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-mono text-xs">sb-…-auth-token</td>
              <td>Local storage</td>
              <td>Keeps you signed in. Strictly necessary.</td>
              <td>Until you sign out</td>
            </tr>
            <tr>
              <td className="font-mono text-xs">sidebar:state</td>
              <td>Cookie</td>
              <td>Remembers whether you collapsed the dashboard sidebar. Preference.</td>
              <td>7 days</td>
            </tr>
            <tr>
              <td className="font-mono text-xs">pd-splash-seen</td>
              <td>Session storage</td>
              <td>Plays the opening animation only once per visit. Preference.</td>
              <td>Until you close the tab</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'third-party',
    title: 'Third parties',
    body: (
      <ul>
        <li>
          <strong>Google Fonts:</strong> your browser downloads the site’s typefaces from Google, which receives your
          IP address and browser details with that request. Paper Dispatch does not ask Google Fonts to set cookies.
        </li>
        <li>
          <strong>Supabase:</strong> the app talks to our hosting provider to sign you in and load data. Your sign-in
          token is stored in local storage as listed above.
        </li>
      </ul>
    ),
  },
  {
    id: 'control',
    title: 'Managing cookies and storage',
    body: (
      <>
        <p>
          You can view and delete cookies and site data in your browser settings. Clearing them signs you out and
          resets your sidebar preference.
        </p>
        <p>
          Blocking local storage entirely will prevent you from signing in, because the sign-in session cannot be
          kept.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we ever add new cookies or storage, this page will be updated first. For how we handle personal
        information more generally, see the <Link to="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
];

export default function CookiePolicy() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Cookie Policy"
      intro="The small amount of browser storage Paper Dispatch uses, and why."
      sections={sections}
      related={[
        { to: '/privacy', label: 'Privacy Policy' },
        { to: '/terms', label: 'Terms & Conditions' },
      ]}
    />
  );
}
