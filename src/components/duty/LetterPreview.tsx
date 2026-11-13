import { Mail } from 'lucide-react';
import { fmtIsoDate, fmtLetterDate } from '@/lib/duty/letterSettings';
import { printCode, rowCentre, tableSubject, type LetterContent } from '@/lib/duty/letter';

const paras = (text: string, className = 'mb-3') =>
  text.split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => <p key={i} className={`${className} whitespace-pre-line`}>{p}</p>);

/**
 * HTML preview of a letter, laid out like the PDF (duty page, then the
 * guidelines page). The PDF itself is never embedded (the CSP blocks frames
 * and objects); it is downloaded or opened in a new tab instead.
 */
export function LetterPreview({ content: c }: { content: LetterContent }) {
  const page = 'mx-auto max-w-[210mm] rounded-sm border bg-white p-6 font-serif text-[14px] leading-snug text-black shadow-sm sm:p-14';
  const cell = 'border border-black px-2 py-0.5';
  return (
    <div className="space-y-4">
      <div className={page}>
        <div className="mb-6 text-center font-bold">
          {c.letterhead.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        {c.showRefAndDate && (
          <div className="mb-3 flex flex-wrap justify-between gap-2">
            <span>{c.refNo && `No.: ${c.refNo}`}</span>
            <span>{c.issueDate && `Date: ${fmtIsoDate(c.issueDate)}`}</span>
          </div>
        )}
        {c.confidential && <p className="mb-4 font-bold">{c.confidential}</p>}
        {c.refLine && <p className="mb-4">{c.refLine}</p>}
        <div className="mb-5">{c.toLines.map((l, i) => <div key={i}>{l}</div>)}</div>
        {c.subjectLine && <p className="mb-7 font-bold italic">Subject: {c.subjectLine}</p>}
        {c.salutation && <p className="mb-4">{c.salutation}</p>}
        {paras(c.opening, 'mb-2')}
        {c.duties.length > 0 && (
          <div className="mb-6 ml-[5%] mr-[-2%] overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${cell} text-left`}>Date</th>
                  <th className={cell}>College</th>
                  <th className={cell}>Subject</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {c.duties.map((d, i) => (
                  <tr key={i}>
                    <td className={cell}>{fmtLetterDate(d.date)}</td>
                    <td className={`${cell} text-center`}>{rowCentre(d)}</td>
                    <td className={`${cell} text-center`}>
                      <div>{tableSubject(d.subject || d.subjectCode)}</div>
                      {d.subject && d.subject !== d.subjectCode && <div>({printCode(d.subjectCode)})</div>}
                      {c.examTime && <div>[ Time : {c.examTime} ]</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paras(c.afterTable, 'mb-4')}
        {c.contacts.length > 0 && (
          <div className="mb-4 flex flex-wrap justify-between gap-x-6 gap-y-3 font-bold">
            {c.contacts.map((p, i) => (
              <div key={i}>
                <div>{p.name}</div>
                {p.designation && <div>{p.designation}</div>}
                {p.college && <div>{p.college}</div>}
                {p.phone && <div>Phone : {p.phone}</div>}
                {p.email && <div>Email : {p.email}</div>}
              </div>
            ))}
          </div>
        )}
        {c.contactEmail && (
          <p className="mb-8 flex items-center gap-1 font-bold"><Mail className="h-4 w-4" />{c.contactEmail}</p>
        )}
        {paras(c.closing, 'mb-1')}
        <div className="h-16" />
        {c.signOff.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {(c.guidelines.length > 0 || c.guidelinesHeading.length > 0) && (
        <div className={page}>
          {c.guidelinesHeading.map((l, i) => (
            <div key={i} className={i === 0 ? 'mb-4 text-center font-sans text-xl font-bold' : `font-bold ${i === 1 ? 'underline' : ''}`}>{l}</div>
          ))}
          <ol className="mt-3 list-decimal space-y-0.5 pl-7">
            {c.guidelines.map((g, i) => <li key={i}>{g}</li>)}
          </ol>
          <table className="ml-[2%] mt-6 w-[90%] border-collapse">
            <thead>
              <tr className="text-[15px]">
                {['S.no', 'Date', 'College', 'No. of students evaluated'].map((h) => (
                  <th key={h} className="border border-black px-2 py-1 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.duties.map((d, i) => (
                <tr key={i} className="h-9">
                  <td className="border border-black px-2 text-center">{i + 1}</td>
                  <td className="border border-black px-2">{fmtLetterDate(d.date)}</td>
                  <td className="border border-black px-2">{d.cancelled ? 'Cancelled' : d.centreName && d.centreName !== d.centreCode ? `${d.centreCode} - ${d.centreName}` : d.centreCode}</td>
                  <td className="border border-black" />
                </tr>
              ))}
            </tbody>
          </table>
          {c.billNote && <p className="mt-4 pl-[25%]">{c.billNote}</p>}
        </div>
      )}
    </div>
  );
}
