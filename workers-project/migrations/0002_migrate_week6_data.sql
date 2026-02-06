-- Migration: Import Week 6, 2026 data from Google Sheets
-- Run each statement separately in D1 Console

-- ============================================================================
-- TEAM MEMBERS (will skip if already exists due to INSERT OR IGNORE)
-- ============================================================================

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
('tm_migrate_1', 'vivian.nee@vixtechnology.com', 'Vivian Nee', 'Vivian', 'member', 1);

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
('tm_migrate_2', 'david@kubapay.com', 'David Hope', 'David', 'member', 1);

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
('tm_migrate_3', 'tarik@kubapay.com', 'Tarik Dinane', 'Tarik', 'member', 1);

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
('tm_migrate_4', 'richard.cornish@vixtechnology.com', 'Richard Cornish', 'Richard', 'member', 1);

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
('tm_migrate_5', 'becky@voqa.com', 'Rebecca Lalanne', 'Rebecca', 'member', 1);

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
('tm_migrate_6', 'giuseppe@kubapay.com', 'Giuseppe Russotti', 'Giuseppe', 'member', 1);

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
('tm_migrate_7', 'tom@kubapay.com', 'Tom Buerbaum', 'Tom', 'member', 1);

-- ============================================================================
-- SUBMISSIONS - Week 6, 2026
-- ============================================================================

-- Vivian Nee
INSERT OR REPLACE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer, submitted_at)
SELECT 'sub_migrate_1', id, 6, 2026,
'- Interviews locked in for vacant positions in Melbourne (front loading of devs)
- MyBus demo for Captain Cook cruises (potentially RTI opportunity for Sydney ferries)
- Preparation complete for upcoming internal HSE audit
Project Westlink activities still ongoing. Discussion with legal on subcontract terms and conditions for TfNSW opportunity in progress. Have suggested strongly that an in person meeting needs to be schedule to expedite discussions.',
'Current risk is absence of HR presence in Australia as Senior HR BP is unavailable. This could slow progress of Project Westlink without HR oversight.',
'Identify path forward in absence of current Senior HR BP for onboarding of new staff, HR advisory on Project Westlink and day-to-day HR requirements in Australia.',
'Great to see Ruchitha and Maheshi in the Melbourne office this week collaborating with the local team.',
'Vivian has made solid progress this week by securing interviews for Melbourne developer positions, completing a MyBus demo that could open new opportunities with Sydney ferries, and preparing for an internal HSE audit. However, they''re facing a significant challenge with the unavailability of their Senior HR Business Partner, which is creating risks for Project Westlink and could slow down the onboarding of new hires. Their current priority is finding alternative HR support to maintain momentum on critical initiatives.',
'What is your timeline for needing HR support for Project Westlink and the new hires, and have you identified any interim solutions or alternative resources to bridge this gap?',
'Request for HR exit not yet finalised. Interim solution will be to lean on UK HR for assistance where required.',
'2026-02-05T00:29:18.000Z'
FROM team_members WHERE email = 'vivian.nee@vixtechnology.com';

-- David Hope
INSERT OR REPLACE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer, submitted_at)
SELECT 'sub_migrate_2', id, 6, 2026,
'Caveating this with the note that a lot of what is on my desk takes time and can roll from week to week. Preparing ground work and structures for business merger - includes tax and IP work. Concluded set up of Voqa on Sage in order to capture pilot trading and VAT correctly. Includes rework of billing process. Working on Ness revised engagement terms. They are already trying to deviate from the outcome based model. Resolved DART and PHNX billing to assist group cash flow. Concluded the last of the fieldwork for Kuba Group audit.',
'French cash is still in flight. We have secured limited invoice discounting facilities from the bank in France and have managed to accelerate some client receipts to alleviate the immediate pressure. Structural issues are a work in progress with the team in France and will not be an immediate fix. Blockers remain unchanged. It is just volume of work.',
'US meeting for Kuba to resolve project issues/control. Need Michael back from leave. UK GM recruitment. Month end reporting. Commence group insurance renewal.',
NULL,
'David has made solid progress on several key business activities including merger groundwork, system setups for Voqa, and audit completion, though notes that work volume remains his primary challenge. His current priorities focus on resolving project issues through a US meeting, recruitment needs, and routine business operations like month-end reporting and insurance renewals. There''s a concern about Ness potentially moving away from the agreed outcome-based engagement model.',
'Given that work volume continues to be your main blocker and you''re waiting for Michael''s return from leave, what specific tasks or decisions could be delegated or temporarily deprioritized to help you focus on the most critical items like the Kuba project issues and the Ness engagement terms?',
'As much as possible is delegated to the team. John Coyne is key to Ness.',
'2026-02-05T07:42:41.000Z'
FROM team_members WHERE email = 'david@kubapay.com';

-- Tarik Dinane
INSERT OR REPLACE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer, submitted_at)
SELECT 'sub_migrate_3', id, 6, 2026,
'Overall operations across EMEA are progressing as planned, with no new major escalations reported this week. Key programs (NAM TER, PDLL, BFC) continue to move forward following recent milestone validations, with teams focused on delivery execution and acceptance preparation. Cash and invoicing remain driven by customer acceptances, particularly on NAM, Phoenix and Edmonton, with expected payments progressing but still requiring close follow-up. Morrocco is progressing with expecting decisive travel next week. Commercial activity continues at a steady pace, with major bids and workshops ongoing in France, Belgium and Scandi. We are still on the last phase to issue the first offer to TEC tomorrow Miday. Annecy is done today with an increase of the margin.',
'We are still experiencing significant impacts due to the ongoing renovation works on the entire plumbing system related to heating and air conditioning. In addition, team fatigue is becoming noticeable, driven by the high number of parallel topics being handled, particularly for Adrien, who is currently under sustained workload pressure.',
'Morrocco and review of BFC program inc the governance',
NULL,
'Tarik reports that EMEA operations are progressing smoothly with key programs moving forward, though cash flow remains dependent on customer acceptances that require close monitoring. The team is facing challenges from office renovation disruptions and fatigue from high workloads, particularly affecting team member Adrien. Current priorities focus on Morocco progress and reviewing the BFC program governance.',
'Given that Adrien is under sustained workload pressure and the team is experiencing fatigue, what specific steps are you considering to redistribute workload or provide additional support to prevent burnout while maintaining progress on your key priorities?',
'Sophrolgy for some individuals, differing projects when we can and increase the workload given to third party',
'2026-02-05T16:27:52.000Z'
FROM team_members WHERE email = 'tarik@kubapay.com';

-- Richard Cornish
INSERT OR REPLACE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer, submitted_at)
SELECT 'sub_migrate_4', id, 6, 2026,
'a. As discussed on our catch up today, we have been invited to the South Eastern BAFO round - I see this as a positive and my initial levels of confidence has improved - I think it is now a 50/50 binary decision. If we can maintain our current traction with gates having a Southern location increases our footprint and opens up other opportunities with the high volume usage TOCs.
b. Improved our cashflow position bringing in WYCA payments in early and identifying delayed invoicing from TfW and MEL and also we are also well placed to receive milestone payments from TfL. Doing an RCA for the delayed payments has identified a gap in the transition from Projects to Operations. This will need to be improved and ideally use automative processes to remedy these issues.
c. Have made some good progress on the contractual LDs for TfW by creating a framework proposal that mitigates the risk to Vix but satisfies the TfW requirement. This is in early discussion but I am confident with the modelling as a starting point. Once this is resolved this will trigger a £900K milestone payment.',
'a. I have added this as an agenda item for the SL meeting on Monday. I need a program view of the project delivery for UK&I and DPU. Currently, I am reviewing projects in isolation and identifying constraints and parallel resource usage. Having a program view would facilitate a better use of resources and time, and delivery.
b. The WYCA bid is proving challenging due to the number of unknown variables and the level of risk it could expose the business to. I will review the final bid and raise any issues or concerns identified.
c. Losing some key individuals in recent weeks has proved challenging, and we will need to bridge these gaps as a priority - I have engaged with recruitment, and I will continue to work through the process.',
'a. Ensure we are in the best cash position with minimal outstanding payments (good progress is being made)
b. A better understanding of the budget and costs associated with the Command product
c. Closing out the Ironbark discussion so we have a definitive view of the future and can move away from Ness sooner rather than later
d. Improving the transition phases of workflow through the business and identifying ways of achieving this through systems and automation
e. Looking at how we can develop individuals within the business. I am focused on financial performance and delivery but I do need to stop and think about the individuals within the business.
f. Looking a program view to optimise project delivery',
'Becky Lalanne - for ongoing support with Adept and Command - a real superstar
Alex Marx - for adding clarity and professionalism to how we should manage projects
Melissa Scothorne for doing a great job in assisting and doing the lion''s share of the work for project Ironbark
John Coyne - for progressing the work orders with Ness - this is a painful process, and without JC this would have stalled.
Colin Malt - for stepping up to the plate and really starting to own the commercial issues within the DPU and just getting stuck in.',
'Richard reports significant progress this week including advancing to the South Eastern BAFO round (which he now sees as 50/50 odds), improving cashflow by accelerating payments and identifying delayed invoicing issues, and developing a framework to mitigate contractual risks with TfW that could unlock a £900K milestone payment. His main challenges involve needing a program-level view of project delivery across UK&I and DPU, managing the high-risk WYCA bid with many unknowns, and addressing gaps left by recent key personnel departures.',
'Given that you''ve identified the transition from Projects to Operations as a key gap causing delayed invoicing, and you''re prioritizing workflow improvements through systems and automation, what specific steps are you planning to take first to address this transition issue, and how will the program view you''re seeking help with this?',
'a. I want to discuss with Aaron. I think we have some individuals in the business who have the skill sets to take this forward if they have the capacity. Having a program view will then lead to putting in automation tools to drive further improvements. If we can streamline and better plan the resources, we can deliver proportionally more per head.',
'2026-02-05T18:26:26.000Z'
FROM team_members WHERE email = 'richard.cornish@vixtechnology.com';

-- Rebecca Lalanne
INSERT OR REPLACE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer, submitted_at)
SELECT 'sub_migrate_5', id, 6, 2026,
'Voqa Installed 3rd Voqa unit (Hotel) Fixed requirements needed for a launch (now parked) Revised budget & resource allocation to match wider business expectations Phase 2 of pre-order campaign delivered Vix/Kuba products Launched Secretary framework workstream officially Completed delivery plans for Command, including resource allocation & budget',
'My priority list from last week is a 2-3months priority - so have no "delivered" on any of it specifically yet! Working towards Objective 1, we launched the second round of content to LI & Email. Clarity on VAT responsibilities for payout. The topics had been shared and approved, but in reviewing before actioning this week, we have picked up on errors. David has sought external advice. Reconciliation of payments across the 4 platforms is hard (it never matches up), so currently reviewing why. Voqa units in the field are experiencing issues that require manual rebooting and we currently can''t find the root cause. Working on process of elimination. It is clear now that we are missing a further skill/resource to deliver the Command product - and that is testing & Certification. Yasmine is on maternity leave, and lacks knowledge in this area.',
'Voqa product issues Get to bottom of issues, possible fixes and timing to resolve Agree VAT responsibilities & issue first customer invoice Vix/Kuba/Voqa Ensure all resources working across the different products understand that Command & Adept are now the priority, and must scale back work on Voqa until we have clear sight of funding.',
'Alex Marx - continues to bring clarity to delivery plans and is becoming central to the wider product team in getting whats in their heads, onto paper.
Simon Denys - stepping up to propose the Secretary product framework, launched the work stream, owning the topic and pushing it forward independently',
'Rebecca had a productive week with key accomplishments including installing a third Voqa unit, launching the Secretary framework workstream, and completing delivery plans for Command. However, she''s facing several critical blockers including VAT payment clarity issues, technical problems with Voqa units requiring manual reboots, and a significant resource gap in testing & certification expertise needed for the Command product.',
'Given the identified gap in testing & certification expertise for the Command product and Yasmine''s unavailability, what''s your timeline for bringing in this critical resource, and do you need support in defining the role requirements or identifying potential candidates?',
'Voqa dev vs ops Honest conversations with the team around what is needed and how we are prioritising the work across all workstreams. This is where it helps having the same people across these topics and the same project manager who sees what i can''t (Alex). I have asked Brandon Tarr (UK electrical lead) to centralise & lead operational activity for voqa and unit fixes, to remove admin/coordination work from the FR team. Testing & Certs I need to share this observation with Richard. A possible solution is to use his new PO to direct the work, and ask Daniel to step up and take this on (as he did for Voqa). But we will need to accept that he is not trained/skilled, so will be on a learning curve.',
'2026-02-05T18:26:26.000Z'
FROM team_members WHERE email = 'becky@voqa.com';

-- Giuseppe Russotti
INSERT OR REPLACE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer, submitted_at)
SELECT 'sub_migrate_6', id, 6, 2026,
'1) We have issued the final invoice under the CCU contract (closed as of 31/12), relating to the supply of an AFC system aimed at small public transport operators in the Lazio region. In the coming years, we hope this platform will be able to grow significantly.
2) We are making progress regarding the possibility of renewing the software maintenance contracts for the Rome and Palermo systems through direct award.
3) We have initiated discussions with major Italian companies (Telecom Italia, Almaviva) that hold framework agreements for the supply of software systems to public-sector organizations.',
'The new scenarios see us involved in projects based on new technologies, such as cloud solutions and AI-related challenges. We are increasingly dealing with customers who rely on the services of major consulting firms such as Oracle or Deloitte. Our organization should be strengthened with specialists capable of supporting and leading these new challenges. We currently lack a local Cloud Ops role, and it is even more critical to have an Engineering Manager who can guide and direct our developers. Last December, I suggested bringing Giovanni Santarcangelo back on board in this role, but I received no response from management.',
'The priority for the coming weeks is to finalize the renewal of the software maintenance and support contracts for the ATAC, Cotral, and Palermo customers, as these contracts, if renewed, represent a source of recurring revenue that forms the foundation of the local business. A second ongoing priority is the continuous focus on customer system operations.',
'Thanks to the team who work with me and actively participate in meetings with ATAC, helping to inspire them and define a clear path for moving from the current AFC system to a future one: Marina Scarsella and Tobia Anfora',
'Giuseppe has completed a key contract in the Lazio region and is making progress on contract renewals for Rome and Palermo systems, while exploring partnerships with major Italian companies to bypass lengthy procurement processes. However, he faces significant challenges with the organization lacking critical roles like Cloud Ops and Engineering Manager positions needed to handle new cloud and AI-based projects, and he''s frustrated by management''s lack of response to his staffing suggestions.',
'Given that you haven''t received feedback from management on bringing Giovanni Santarcangelo back as Engineering Manager, what alternative approaches are you considering to address the critical Cloud Ops and engineering leadership gaps while pursuing these new technology opportunities?',
'On the Cloud Ops side, we are currently taking a tactical approach by relying on a contractor. From an Engineering Management perspective, I am playing a more hands-on operational role to drive and support the existing team. This approach is probably not very sustainable or efficient in the long term',
'2026-02-06T08:44:31.000Z'
FROM team_members WHERE email = 'giuseppe@kubapay.com';

-- Tom Buerbaum
INSERT OR REPLACE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, shoutouts, ai_summary, ai_question, ai_answer, submitted_at)
SELECT 'sub_migrate_7', id, 6, 2026,
'This week delivered a few solid outcomes. The DART PCI audit was completed, the PHX IVR was deployed into production without issues, and the GitHub and Conan field migration was wrapped up, with Track nearly finished. The RSFS escrow scope was also agreed with Edmonton at a verification only level, simplifying delivery and reducing risk. All of last week''s priorities progressed. The Global Service Management Framework is effectively complete, with only final wrap up activities remaining. AWS security and infrastructure work is well advanced and on track to complete in two weeks time given the size of the tasks. The AI chatbot is in place but still requires some further refinement, which remains in flight.',
'There are no critical blockers, but a few ongoing constraints. Resourcing pressure continues across security and engineering, particularly with bid and delivery demand running in parallel.',
'The main priorities right now are keeping delivery on track and dealing with resourcing pressure. I had a promising initial conversation this week about bringing across some key capability from Ness, and the focus now is on working out how to do that carefully and without disrupting the existing relationship.',
'It''s worth calling out how well the Heads of IT, Security, CloudOps, and Engineering are working together. The alignment between those teams is paying off and showing up in smoother delivery and fewer friction points.',
'Tom had a productive week with several key deliverables completed including the DART PCI audit, PHX IVR production deployment, and GitHub/Conan field migration, while also simplifying the RSFS escrow scope. While there are no critical blockers, ongoing resourcing pressure across security and engineering teams remains a constraint as bid and delivery work runs simultaneously. Tom is exploring bringing capability from Ness to address resource constraints while being careful not to disrupt existing relationships.',
'What specific timeline are you working with for the potential capability transfer from Ness, and what key criteria will you use to determine if this move can be executed without negatively impacting the existing relationship?',
'The timeline is as soon as possible, but only where it clearly reduces delivery risk. The conversation with the engineer at Ness was about understanding whether bringing that capability across would help stabilise known pressure points and speed things up. If that holds true, the next step would be to plan how to do it properly, in a way that avoids disruption and doesn''t damage the relationship with Ness.',
'2026-02-06T09:29:56.000Z'
FROM team_members WHERE email = 'tom@kubapay.com';
