export const bad1 = process.env.NEXT_PUBLIC_TRANSIT_TOKEN; // line 1: flagged
export const bad2 = process.env["NEXT_PUBLIC_DASHBOARD_KEY"]; // line 2: flagged
export const bad3 = process.env.NEXT_PUBLIC_KEY; // line 3: flagged
export const ok1 = process.env.NEXT_PUBLIC_API_URL;
export const ok2 = process.env.TRANSIT_TOKEN;
export const ok3 = process.env.NEXT_PUBLIC_REVIEWED_KEY;
export const ok4 = process.env.NEXT_PUBLIC_MONKEY_BUSINESS;
