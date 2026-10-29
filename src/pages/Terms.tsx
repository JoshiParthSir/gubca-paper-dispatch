import { Link } from 'react-router-dom';
import { LegalDocument, type LegalSection } from '@/components/public/LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    body: (
      <p>
        By signing in to Paper Dispatch you agree to these Terms & Conditions and to the university’s examination
        regulations. If you do not agree, do not use the system and inform the university.
      </p>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who may use Paper Dispatch',
    body: (
      <>
        <p>
          Paper Dispatch is only for authorised university staff and college admins of affiliated colleges. Accounts
          are created by the university; there is no public sign-up.
        </p>
        <p>
          Your account is personal. You may not let anyone else use it, and you may use it only for the college you
          are assigned to.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Account security',
    body: (
      <ul>
        <li>You must change the temporary password you receive when you first sign in.</li>
        <li>Keep your password confidential and do not reuse it on other sites.</li>
        <li>Sign out on shared computers.</li>
        <li>Tell the university immediately if you suspect someone else has used your account.</li>
        <li>The university may reset, suspend or remove any account to protect the examinations.</li>
      </ul>
    ),
  },
  {
    id: 'confidentiality',
    title: 'Confidentiality of question papers',
    body: (
      <>
        <p>
          Question papers are <strong>confidential examination material</strong>. When you download a paper you agree
          to:
        </p>
        <ul>
          <li>Download it only during its scheduled exam window and only for conducting that exam at your college</li>
          <li>
            Not copy, forward, upload, photograph, publish or share it with anyone not involved in conducting the
            exam
          </li>
          <li>Follow the university’s rules for printing, handling and destroying exam material</li>
          <li>Report any suspected leak or unauthorised access to the university straight away</li>
        </ul>
        <p>
          Any breach may lead to action under the university’s regulations and applicable law, including action
          against the college.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You must not:</p>
        <ul>
          <li>Try to access papers, data or accounts belonging to other colleges or users</li>
          <li>Try to bypass, probe or disable the system’s security or time-based access controls</li>
          <li>Use automated tools to access, download or copy content from the system</li>
          <li>Upload harmful files or interfere with the system’s operation</li>
        </ul>
      </>
    ),
  },
  {
    id: 'monitoring',
    title: 'Monitoring and audit',
    body: (
      <p>
        Every paper download is recorded with the account, the paper and the time. These records may be reviewed by
        the university and used as evidence in any investigation into examination malpractice. See the{' '}
        <Link to="/privacy">Privacy Policy</Link> for details.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability',
    body: (
      <>
        <p>
          The university aims to keep Paper Dispatch available throughout every exam window, but cannot guarantee
          uninterrupted service. Planned maintenance will be scheduled outside exam windows where possible.
        </p>
        <p>
          Download your paper as soon as its window opens. If you cannot access a paper during its window, contact
          the university immediately so an alternative arrangement can be made.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Temporary storage of papers',
    body: (
      <p>
        Paper files are deleted automatically 7 days after their last exam. Paper Dispatch is a delivery system, not
        an archive; the university keeps its own master copies.
      </p>
    ),
  },
  {
    id: 'ownership',
    title: 'Ownership',
    body: (
      <p>
        Question papers and examination content belong to the university. The Paper Dispatch software, design and
        branding remain the property of their respective owners. Using the system does not give you any rights in
        either.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the extent permitted by law, the system is provided “as is”, and neither the university nor the
        developers are liable for indirect or consequential loss arising from its use or temporary unavailability.
        Nothing in these terms limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and termination',
    body: (
      <p>
        The university may update these terms or withdraw access at any time. Continuing to use the system after an
        update means you accept the revised terms. The “last updated” date at the top shows the current version.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of India. Any dispute will be subject to the jurisdiction of the courts
        having jurisdiction over the university.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        For questions about these terms, contact the university’s examination section. College admins can also raise
        questions through their college principal’s office.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms & Conditions"
      intro="The rules for using Paper Dispatch and handling confidential examination material."
      sections={sections}
      related={[
        { to: '/privacy', label: 'Privacy Policy' },
        { to: '/cookies', label: 'Cookie Policy' },
      ]}
    />
  );
}
