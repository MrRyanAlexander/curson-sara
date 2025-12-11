You are the Cursor build planner working inside a TypeScript / Netlify project.

Context

Codebase: curson-sara on GitHub (already checked out in this workspace).

Stack: Node 20, TypeScript, Netlify Functions, Netlify Blobs, simple web chat UI.

Current behavior: Sara receives messages from Messenger or a web chat, loads a user profile and message history from blobs, calls a single LLM (OpenAI Responses API, currently gpt-5.1 / gpt-5-mini) with tools, and persists damage reports plus messages.

I want you to create a detailed build plan, not code yet, for turning this into a fully working demo simulator with three roles and a map/chat UI, all running in demo mode using fictional data.

High level goal

Create Sara Beta: Simulation Mode only.

No real storms.

No real users.

No real Facebook posts or real damage intake.

Everything is built around a fictional Cat 4 storm called Hurricane Santa that hit a fictional town called Saraville.

We have three canonical users:

Resident: John Doe

City government EM worker: Jane Smith

Contractor: John Smith

When anyone messages Sara in this demo, she:

Introduces herself.

Clearly states this is a simulation only and not an official damage reporting channel.

Asks which role they want to simulate:

Resident in Saraville affected by Hurricane Santa

City Emergency Management staff in Saraville

Local contractor in Saraville

Based on their choice, she runs them through a prefilled scenario for that role instead of asking the human to type long damage descriptions.

All logic should be fully wired so a tester can walk through:

Messenger or web chat conversation.

A map + chat UI showing reports and hints.

Role based views for Resident, City, and Contractor.

Downloadable but clearly simulated reports.

Demo vs live behavior

Introduce a global mode flag, for example SARA_MODE:

SARA_MODE = "demo" (default for this build plan)

Later it could support "live", but for now assume demo only.

In demo mode:

All data is stored under a demo namespace in blobs (for example demo_damage_reports, demo_projects), or tagged with isDemo: true.

Damage reports, projects, and user objects are seeded and simulated.

LLM still runs, but tools never create real posts or interact with real systems outside Netlify / OpenAI.

Any “post to Facebook” action must become a preview only.

The build plan must note which parts of the code need to branch on SARA_MODE.

Core flows to support

Design concrete flows that the LLM and UI will implement. The build plan should map these flows to API endpoints, LLM tools, and front end components.

1. Role selection on first contact

When a new user starts a conversation (or when we detect they are in demo mode without having chosen a role):

Sara sends intro text including:

Brief description of Hurricane Santa and Saraville.

Statement that this is a simulation.

Menu:

Simulate Resident (John Doe)

Simulate City EM Worker (Jane Smith)

Simulate Contractor (John Smith)

The plan should specify:

Where to change the system prompt so Sara always stays in “demo simulation” persona.

How to track the selected role in the user profile blob.

How to handle if the user changes roles later (for the demo, it is fine to restart from a clean scenario).

2. Resident demo flow (John Doe)

Resident chooses option 1.

Conversation steps (high level):

Sara explains John Doe’s situation in Saraville after Hurricane Santa and summarizes the key damage on his property.

Sara tells the user that she already “has” the basic details (name, address, damage type, insurance status, help needed, location status) as pre filled demo data.

Sara says the last step is to confirm the location on a map and review the report.

Sara sends a link that opens a map + chat view in the browser, for example:

https://<site>/demo-map?token=XYZ

Under the hood:

Use a time limited token or session id that links:

user id

report id

role = resident

mode = demo

In the map + chat UI:

Left side:

Map centered on John Doe’s address in Saraville.

A single property marker with a summary card of the demo damage report.

Right side:

Chat transcript reconstructed from the message history for this conversation so it looks continuous with Messenger or the web chat.

The resident can:

Click the marker or “View full report” button to open a report pane over the map.

See editable fields in the report (address, damage type, notes, insurance, help requested, etc).

Save changes.

Click a “Download report” button that produces a simulated export (JSON or PDF) clearly labeled as DEMO.

Important:

Hints are local only:

Map clicks, report view toggles, card clicks etc should trigger small hint messages in the chat from Sara (for example “If you want me to update this for you, just type it in the chat”), but these hints are generated on the client without hitting the LLM.

The build plan should describe a simple local hint system:

Count clicks for each interaction type.

Only show a hint after N clicks to avoid being annoying.

LLM is still used for chat messages:

Any text the user types into the chat panel in the map view should be sent to the backend, run through the full LLM pipeline with tools, and the updated report should be re rendered live.

Example queries to support:

“Update the address to 123 Main Street instead of 456 Oak Drive.”

“Show me the full report.”

“Zoom the map out to about a mile.”

“Show me nearby reports.”

Nearby reports for the Resident:

Resident sees only aggregated information:

Heatmap style or shaded areas, no exact addresses, no clickable dots.

Summary stats like:

total reports in area

reports assigned

reports with progress

completed reports

Some simple popularity stats, like “top contractors in this area by number of demo jobs and positive feedback”.

Use fully fictional seed data for these reports and contractor stats.

3. City EM worker demo flow (Jane Smith)

City worker chooses option 2.

Flow:

Sara explains Jane Smith’s role and how the city is using Sara to understand and respond to damage after Hurricane Santa.

Provide a link to the same map + chat UI, but with a city role token.

In the map view for city role:

City worker sees:

All demo reports as points with cluster behavior or heatmap.

Full details for each report, including resident contact and address.

Simple filters like “unassigned”, “assigned”, “completed”.

City worker can:

Click a report, see the full report panel, leave notes, change status.

Export a CSV or download an aggregated report (demo only).

Chat interactions:

Example: “Show me all unassigned reports near the high school.”

Sara uses tools to query seeded demo data and replies with summaries.

Permissions:

City role can see PII in the demo.

The plan should note how to enforce this in code even in demo mode, using role info from the token or user profile.

4. Contractor demo flow (John Smith)

Contractor chooses option 3.

Flow:

Sara explains John Smith’s contractor role, including how he gets matched to resident reports.

Contractor map view:

Shows only:

Reports assigned to this contractor.

Aggregated stats about work in Saraville (number of leads, assigned jobs, feedback).

They can:

Open assigned reports.

Mark progress states (for example “bid sent”, “bid accepted”, “work in progress”, “complete”).

Chat interactions:

“Show me my open jobs.”

“Mark the Oak Street roof job as complete.”

“How many jobs did I complete last week in Saraville?”

Again, all data is seeded and simulated.

5. Data model for demo mode

Design a minimal but explicit data model. The build plan should define these types clearly and map them to Netlify Blob paths.

Suggested entities:

DemoDamageReport

id

residentName

address

geo location

damage type

insurance info

help requested

status

assigned contractor id

createdAt, updatedAt

isDemo: true

DemoProject (for contractor workflow)

id

contractorId

linked reportId

status (bid, in progress, completed)

notes

DemoUserRoleInfo

userId

role: "resident" | "city" | "contractor"

canonicalName (John Doe, Jane Smith, John Smith)

any extra demo metadata you need

Seed data file(s)

A JSON file in the repo that holds all the fictional demo reports, projects, and stats for Saraville and Hurricane Santa.

A seeding function that writes this into Netlify Blobs on first run or first deployment in demo mode.

The plan should show where to place these types and how to reuse existing blobs utilities.

LLM and tools changes

The build plan should describe:

How to extend the system prompt for demo mode to include:

Hurricane Santa description.

Saraville context.

Role specific instructions.

Strong guardrails about this being a simulation.

How to extend or adjust tools so they work for demo mode:

Tools operate on DemoDamageReport and DemoProject where appropriate.

Tools for:

listing and updating reports

changing status

generating map summaries

returning stats for residents, city, contractors

A clear rule:

Non textual UI events (map clicks, card toggles) do not call the LLM.

Only chat text goes through the full LLM pipeline.

You do not need to implement the tools yet, just design which ones we need, their parameters, and where they plug into the existing tool execution code.

Frontend requirements

The build plan should propose:

A new map + chat UI page or component. It can be a simple React or vanilla TypeScript front end hosted in the same Netlify site.

How it will:

Load initial state from a tokenized endpoint.

Render the conversation history.

Capture chat input and send it to the backend.

Render map and markers for different roles.

Implement local hint logic with click counters per interaction type.

Mention any libraries you expect to use for the map and state management.

What I want from you as Cursor

Produce a step by step build plan that:

Lists all new files to add and existing files to modify, with a short summary of the changes for each.

Describes the new data structures and blob namespaces.

Describes the new or modified Netlify functions and their routes.

Specifies the tools and prompt changes needed for the LLM.

Describes the new front end components for the map + chat UI and how they integrate with existing chat.

Calls out any risks, edge cases, or open questions you think I should decide before implementation.

After the build plan is generated and approved, we will then apply it step by step to the actual code.