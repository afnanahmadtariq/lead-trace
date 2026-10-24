# Lead Trace material sources and scope

Updated 24 October 2026 from repository commit `ffb7af0`, with release terminology applied across the app, exports, screenshots, and materials. The pitch remains an editable 12-slide PowerPoint, with a matching PDF and a three-page overview. Original logos are preserved; InsightIQ appears only in the transition context. The deck uses a light background throughout. Architecture and workflow visuals follow the supplied reference: white rounded rectangles, blue headings, navy body text, light borders, and blue arrows. The diagram text and connectors remain editable in PowerPoint; SVG and Mermaid sources are included for the image exports.

## Product captures

Authenticated screenshots were captured from the current app in isolated sample workspaces labeled **Demo workspace · sample data** or **Sample data**. Maya Chen / Northstar Analytics, Alex Rivera / Southstar Studio, Jordan Lee / Harbor Logistics, their email addresses, deal values, and research content are fictional demonstration fixtures. No discovery subscription, paid provider call, email, Calendar consent, event, or invitation was used to produce these images. The app's Calendar screen shows **Ready to connect**, not a fabricated connected state.

The image library includes Home, the contact directory/detail, deep-search criteria/results/evidence, pipeline Board/Table, follow-ups, integrations, research entry/history, cited evidence, conversation angles, outreach, the landing page, and the brand transition.

## Implemented scope

- `apps/api/src/leads/`: bounded company-first discovery, public registry checks, exact source quotes, and leased background lead jobs.
- `apps/web/components/leads/`: search setup, qualification/evidence review, and CRM conversion.
- `apps/web/components/crm/` and `apps/api/src/crm/`: contacts, ownership, record controls, notes, deals, follow-ups, CSV, and optional Google Calendar event creation.
- `apps/worker/src/lead_trace_worker/`: research discovery/evidence processing, briefing, and citation checks.
- `docs/assets/architecture.mmd` and `docs/assets/workflow.mmd`: editable engineering diagram sources.

Shared company records, custom pipelines, contact merging, recurring searches, email integration, and two-way Calendar sync remain future work. Follow-ups track actions; automatic reminders are not implemented. Contact deletion is unavailable while research history exists. Calendar needs member OAuth consent; invitations are opt-in and existing Google events are retained when local records are removed.

## Recorded live evidence

The pitch's live-validation slide refers to `docs/lead-generation-live-audit.html`, a separate **23 October 2026** cohort: 9 prospects, 1 supported by every requested criterion, followed by a completed CRM-to-research journey with 11 research sources and 15 evidence items. The source remains available at https://github.com/afnanahmadtariq/lead-trace/blob/v1.4.0/docs/lead-generation-live-audit.html.

These counts are not a current search, a precision/recall benchmark, market coverage, verified emails, buying interest, or measured sales outcomes. Public evidence can be stale. Review the original sources before outreach. The fictional product captures do not represent this live cohort.

The separate 24 October local backend audit is in `docs/backend-live-api-audit.html` and its redacted JSON record. It records 275 passing checks, six failed assertions across four findings, and limitations around deep-search yield, worker model configuration, FAQ evidence, and malformed workspace input. Those findings remain unresolved; refreshing the visual materials does not change their status.

## Narrated tour

The 103-second updated demo uses the same installed Samantha system voice as the earlier version, with current product images and synchronized caption cues. The narration and captions are included beside the MP4. The tour covers the transition, implemented discovery/CRM/research flow, optional Calendar, recorded audit, and remaining priorities.
