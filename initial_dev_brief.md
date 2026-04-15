RIPPED — Developer Brief v0.1
April 10, 2026 | For Ben

Problem
Online card break buyers have zero objective information when purchasing team spots. Breakers control pricing, control hype, and buyers make $50–$500 decisions based on vibes and stream energy. The average break buyer loses 40–60 cents on the dollar with no way to know it.

Solution
A single-page web tool that calculates the expected value of any team spot in a card break and compares it against what the breaker charged.
User flow:
	1	Select product — 2025 Topps Chrome Football Hobby Case
	2	Select team
	3	Enter what they paid for the spot
	4	See the math
Output:
	•	Their team's players on the checklist
	•	Probability of pulling each card type (base, refractor, numbered, auto, case hit)
	•	Estimated value range per pull type, sourced from prior year comps — labeled clearly as estimates
	•	Expected value of their spot as a single dollar number
	•	The gap: what they paid vs. what the math says it's worth
	•	Verdict: Fair Deal / Slight Edge to Breaker / Significant Markup / You Got Ripped

Technical Scope — MVP Only
Frontend: Single page, mobile-first, no login, no account Backend: None. All data is static JSON that DJ maintains and updates manually Hosting: Vercel or Netlify — free tier is fine Timeline: Live before Wednesday April 15

Data Flow
DJ provides Ben a JSON file containing:
	•	32 NFL teams → player mappings
	•	Full checklist with card types and odds (from Topps published odds sheet)
	•	Value estimates per card type per player tier (sourced from 2024 Chrome Football comps)
Ben's tool reads that file. DJ updates it manually as 2025 sold data comes in. No scraping. No live API calls.

Design Direction
	•	Dark background, hobby aesthetic
	•	EV output number is the largest element on the page
	•	Verdict color-coded: Green → Yellow → Orange → Red
	•	Clean. Fast. No friction.

What Ben Needs From DJ by Sunday
	•	Confirmed domain name
	•	Data JSON in agreed format (Ben specifies: JSON / CSV / Google Sheet)
	•	Player tier assignments for Chrome Football checklist
