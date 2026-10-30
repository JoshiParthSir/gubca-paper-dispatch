import { Link } from 'react-router-dom';
import { LegalDocument, type LegalSection } from '@/components/public/LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: 'Who this policy covers',
    body: (
      <>
        <p>
          Paper Dispatch is an exam paper allocation and dispatch system operated by the university for its
          affiliated colleges. This policy explains what personal information the system handles, why, and how it
          is protected.
        </p>
        <p>
          The university is responsible for the personal information processed in Paper Dispatch. It applies to
          everyone who has an account: university staff who manage the system and college admins who receive
          question papers.
        </p>
      </>
    ),
  },
  {
    id: 'information',
    title: 'Information we collect',
    body: (
      <>
        <h3>Account information</h3>
        <ul>
          <li>Your full name and email address (your email is your login ID)</li>
          <li>Your role (university or college admin) and the college you are assigned to</li>
          <li>
            Your password, which is stored only in hashed form by our authentication provider. Nobody, including the
            university, can see it.
          </li>
        </ul>
        <h3>Activity records</h3>
        <ul>
          <li>
            A download log each time a question paper is downloaded: which account downloaded which allocated paper,
            and the date and time
          </li>
        </ul>
        <h3>Institutional information</h3>
        <ul>
          <li>College details entered by the university, such as name, code, address, contact email and phone</li>
          <li>Exam schedules and the question paper files themselves</li>
        </ul>
        <h3>What we do not collect</h3>
        <p>
          The system does not record your IP address or location in download logs, does not use analytics or
          advertising tools, and does not track you across other websites.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use your information',
    body: (
      <>
        <p>Your information is used only to run examinations securely, specifically to:</p>
        <ul>
          <li>Sign you in and show you the papers allocated to your college</li>
          <li>Make each paper available only during its scheduled exam window</li>
          <li>Keep an audit trail of downloads so the university can verify how papers were accessed</li>
          <li>Protect the system against misuse and investigate security incidents</li>
          <li>Contact you about your account or the examination process</li>
        </ul>
        <p>
          We do not sell your information, use it for advertising, or use it for any purpose unrelated to conducting
          examinations.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Storage and security',
    body: (
      <>
        <p>
          Paper Dispatch runs on secure, professionally managed cloud infrastructure. The protections include:
        </p>
        <ul>
          <li>Encryption of all data in transit (HTTPS)</li>
          <li>Question papers kept in private storage that is never publicly linked</li>
          <li>Database access rules so each college admin can see only their own college’s papers</li>
          <li>Server-side checks so a paper cannot be downloaded outside its exam window</li>
          <li>Accounts created only by the university, with a mandatory password change on first sign-in</li>
        </ul>
        <p>
          No system is perfectly secure. If you believe your account has been compromised, contact the university
          immediately so your password can be reset.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep information',
    body: (
      <>
        <table>
          <thead>
            <tr>
              <th>Information</th>
              <th>Kept for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Question paper files</td>
              <td>Deleted automatically 7 days after the paper’s last scheduled exam</td>
            </tr>
            <tr>
              <td>Your account</td>
              <td>Until the university removes it</td>
            </tr>
            <tr>
              <td>Download logs</td>
              <td>
                As long as the university needs them for examination records. If an account is deleted, its log
                entries are kept but no longer linked to that account.
              </td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing with others',
    body: (
      <>
        <p>We share information only where needed to run the service or where the law requires it:</p>
        <ul>
          <li>
            <strong>Service providers</strong> who securely store data and run the sign-in service on our behalf,
            under obligations to protect it and use it only to provide that service.
          </li>
          <li>
            <strong>A web font service</strong> that delivers the typefaces used on this site. When pages load, your
            browser requests font files from it, which shares your IP address and browser details as part of that
            request.
          </li>
          <li>Authorities, where disclosure is required by law or needed to investigate examination malpractice.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          Depending on applicable law, including India’s Digital Personal Data Protection Act, 2023, you may have the
          right to:
        </p>
        <ul>
          <li>Access the personal information held about you</li>
          <li>Have inaccurate information corrected (you can update your name yourself on your Profile page)</li>
          <li>Ask for your account and personal information to be erased, where it is no longer needed</li>
          <li>Raise a concern about how your information is handled</li>
        </ul>
        <p>To make a request, contact the university as described below.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and browser storage',
    body: (
      <p>
        We use a small amount of browser storage to keep you signed in and remember display preferences, and no
        tracking cookies. See the <Link to="/cookies">Cookie Policy</Link> for the full list.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy when the system changes. The “last updated” date at the top shows when it was last
        revised. Significant changes will be communicated to account holders through the university.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        For questions about this policy or your information, contact the university’s examination section. College
        admins can also raise requests through their college principal’s office.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy Policy"
      intro="What information Paper Dispatch handles, why, and how it is protected."
      sections={sections}
      related={[
        { to: '/terms', label: 'Terms & Conditions' },
        { to: '/cookies', label: 'Cookie Policy' },
      ]}
    />
  );
}
