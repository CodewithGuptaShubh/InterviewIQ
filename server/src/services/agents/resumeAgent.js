import { ROLE_HINTS, SKILL_DICTIONARY } from "../../data/skills.js";
import { clamp } from "../../utils/http.js";
import { aiProvider, callJson } from "../llm.js";

const SYSTEM = `You are the Resume Analysis Agent for InterviewIQ, an AI mock interview platform.
Extract a normalized candidate profile from resume text.
Do not invent missing data. When uncertain, use null or an empty array.
Categorize skills as language, framework, database, tool, cloud, concept, or soft_skill.`;

const SHAPE = `{
  "targetRole": "best-fit role for this candidate (use the provided target role if given)",
  "seniority": "student|fresher|junior|mid|senior",
  "difficulty": "beginner|intermediate|advanced",
  "readinessEstimate": 0-100 integer estimate of interview readiness from the resume alone,
  "skills": [{ "name": "React", "category": "framework", "confidence": 0.0-1.0 }],
  "projects": [{ "title": "", "description": "", "technologies": [""], "impact": "", "questionsHint": ["question an interviewer could ask"] }],
  "experience": [{ "company": "", "role": "", "startDate": "", "endDate": "", "summary": "" }],
  "education": [{ "institution": "", "degree": "", "year": "", "score": "" }],
  "certifications": [""],
  "strengths": ["3-4 specific strengths grounded in the resume"],
  "gaps": ["3-4 specific areas to prepare for interviews"],
  "resumeScore": 0-100 integer rating of the resume document itself (clarity, impact, ATS-friendliness, relevance to the target role),
  "suggestions": [{ "section": "Projects|Experience|Skills|Summary|Education|Formatting|Other", "issue": "what is weak, quoting the resume where possible", "suggestion": "a concrete rewrite or action", "priority": "High|Medium|Low" }]  // 4-6 items, most impactful first
}`;

const SENIORITIES = ["student", "fresher", "junior", "mid", "senior"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

const asArray = (value) => (Array.isArray(value) ? value : []);
const asStrings = (value) => asArray(value).filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());

function normalize(raw, targetRole) {
  return {
    targetRole: targetRole || raw.targetRole || "Software Engineer",
    seniority: SENIORITIES.includes(raw.seniority) ? raw.seniority : "fresher",
    difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : "intermediate",
    readinessEstimate: clamp(raw.readinessEstimate ?? 55),
    skills: asArray(raw.skills)
      .filter((skill) => skill?.name)
      .slice(0, 30)
      .map((skill) => ({ name: String(skill.name), category: skill.category || "concept", confidence: Number(skill.confidence) || 0.7 })),
    projects: asArray(raw.projects)
      .filter((project) => project?.title)
      .slice(0, 6)
      .map((project) => ({
        title: String(project.title),
        description: project.description || "",
        technologies: asStrings(project.technologies),
        impact: project.impact || "",
        questionsHint: asStrings(project.questionsHint)
      })),
    experience: asArray(raw.experience).filter((item) => item?.company || item?.role),
    education: asArray(raw.education).filter((item) => item?.institution || item?.degree),
    certifications: asStrings(raw.certifications),
    strengths: asStrings(raw.strengths).slice(0, 5),
    gaps: asStrings(raw.gaps).slice(0, 5),
    resumeScore: clamp(raw.resumeScore ?? 60),
    suggestions: asArray(raw.suggestions)
      .filter((item) => item?.suggestion)
      .slice(0, 8)
      .map((item) => ({
        section: String(item.section || "Other"),
        issue: String(item.issue || ""),
        suggestion: String(item.suggestion),
        priority: ["High", "Medium", "Low"].includes(item.priority) ? item.priority : "Medium"
      }))
  };
}

const ACTION_VERBS = /^(built|developed|created|designed|implemented|led|reduced|improved|optimized|launched|automated|architected|migrated|delivered|increased|engineered|deployed)\b/i;

function heuristicSuggestions(text, sections, skills, projects) {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 25);
  const actionLines = lines.filter((line) => ACTION_VERBS.test(line.replace(/^[•\-*▪●◦]\s*/, ""))).length;
  const hasMetrics = /\d+\s?%|\d+x\b|\d{2,}[,+]?\s*(users|students|requests|customers|downloads)/i.test(text);
  const has = (pattern) => Object.keys(sections).some((name) => pattern.test(name));
  const suggestions = [];
  const add = (section, issue, suggestion, priority) => suggestions.push({ section, issue, suggestion, priority });

  if (!hasMetrics) add("Projects", "Project and experience points don't show measurable impact.", "Add numbers to at least 3 bullets, e.g. 'Reduced page load time by 40%' or 'Served 2,000+ students'.", "High");
  if (!has(/project/)) add("Projects", "No Projects section was found.", "Add 2-3 projects with the tech stack, your specific contribution, and the outcome.", "High");
  else if (projects.length < 2) add("Projects", "Only one project is clearly described.", "Add a second project that shows a different skill (e.g. backend, data, or deployment).", "Medium");
  if (lines.length && actionLines / lines.length < 0.3) add("Experience", "Few bullet points start with strong action verbs.", "Start each bullet with a verb like Built, Designed, Optimized, or Led, followed by what you did and the result.", "Medium");
  if (!/github\.com|gitlab\.com/.test(lower)) add("Other", "No GitHub or portfolio link.", "Add your GitHub profile and links to live demos so interviewers can verify your work.", "Medium");
  if (!/linkedin\.com/.test(lower)) add("Other", "No LinkedIn profile link.", "Add a LinkedIn URL in the header next to your email and phone number.", "Low");
  if (!has(/skill/)) add("Skills", "No dedicated Skills section.", "Add a Skills section grouped by Languages, Frameworks, Databases, and Tools for ATS keyword matching.", "High");
  else if (skills.length < 6) add("Skills", "The skills list is short.", "List the specific tools you have used in projects (frameworks, databases, cloud, testing).", "Medium");
  if (!has(/summary|objective|profile/)) add("Summary", "No summary at the top.", "Add a 2-line summary naming your target role, core stack, and one standout achievement.", "Low");
  if (words < 200) add("Formatting", "The resume is very short.", "Expand project and experience bullets to explain your contribution and results; aim for a full page.", "Medium");
  if (words > 900) add("Formatting", "The resume is long for an early-career role.", "Trim to one page by cutting older or less relevant items and merging similar bullets.", "Medium");

  const score = clamp(85 - suggestions.filter((s) => s.priority === "High").length * 12 - suggestions.filter((s) => s.priority === "Medium").length * 5 - suggestions.filter((s) => s.priority === "Low").length * 2);
  return { suggestions: suggestions.slice(0, 6), resumeScore: Math.max(score, 25) };
}

const SECTION_HEADINGS = /^(projects?|academic projects|personal projects|experience|work experience|internships?|education|skills|technical skills|certifications?|achievements|awards|summary|objective|profile|hobbies|interests|languages|publications|extra[- ]curricular.*|positions? of responsibility)\s*:?$/i;

function splitSections(text) {
  const sections = {};
  let current = "header";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length < 40 && SECTION_HEADINGS.test(line)) {
      current = line.toLowerCase().replace(/[:\s]+$/, "");
      continue;
    }
    (sections[current] ||= []).push(line);
  }
  return sections;
}

function sectionLines(sections, pattern) {
  return Object.entries(sections).filter(([name]) => pattern.test(name)).flatMap(([, lines]) => lines);
}

function heuristicProfile(text, targetRole) {
  const lower = text.toLowerCase();
  const skills = SKILL_DICTIONARY.filter(([, , pattern]) => pattern.test(lower)).map(([name, category]) => ({ name, category, confidence: 0.6 }));
  const technical = skills.filter((skill) => skill.category !== "soft_skill");
  const sections = splitSections(text);

  // A project title is a short line (bullets are often lost in PDF text), followed by lines describing it.
  const projectLines = sectionLines(sections, /project/);
  const titlePart = (line) => line.split(/\s[|–—-]\s|\(/)[0].trim();
  const isTitle = (line) => !/^[•\-*▪●◦]/.test(line) && !/\.$/.test(line) && titlePart(line).split(/\s+/).length <= 5;
  const projects = [];
  for (let i = 0; i < projectLines.length && projects.length < 4; i++) {
    const line = projectLines[i];
    if (!isTitle(line)) continue;
    const details = [];
    for (let j = i + 1; j < projectLines.length && !isTitle(projectLines[j]); j++) {
      if (details.length < 3) details.push(projectLines[j].replace(/^[•\-*▪●◦]\s*/, ""));
    }
    const blob = `${line} ${details.join(" ")}`.toLowerCase();
    const technologies = technical.filter((skill) => SKILL_DICTIONARY.find(([name]) => name === skill.name)[2].test(blob)).map((skill) => skill.name);
    const title = titlePart(line);
    projects.push({
      title: title || line,
      description: details[0] || "",
      technologies,
      impact: details.find((detail) => /\d+%|\d+x|improv|reduc|increas|users|faster/i.test(detail)) || details[1] || details[0] || "",
      questionsHint: []
    });
  }

  const experienceLines = sectionLines(sections, /experience|internship/);
  const hasInternship = /intern(ship)?/i.test(text);
  const yearsMatch = lower.match(/(\d+)\+?\s*years? of experience/);
  const years = yearsMatch ? Number(yearsMatch[1]) : 0;
  const seniority = years >= 5 ? "senior" : years >= 2 ? "mid" : experienceLines.length > 3 && !hasInternship ? "junior" : /b\.?tech|b\.?e\b|bachelor|student|university|college/i.test(text) ? (hasInternship ? "fresher" : "student") : "fresher";

  const depth = technical.length + projects.length * 2 + (hasInternship ? 3 : 0) + years * 3;
  const difficulty = depth >= 22 || years >= 3 ? "advanced" : depth >= 10 ? "intermediate" : "beginner";
  const role = targetRole || ROLE_HINTS.find(([pattern]) => pattern.test(lower))?.[1] || "Software Engineer";

  const has = (name) => skills.some((skill) => skill.name === name);
  const strengths = [];
  if (technical.length >= 8) strengths.push(`Broad technical stack across ${technical.length} technologies`);
  if (projects.length >= 2) strengths.push(`Hands-on experience with ${projects.length} projects`);
  if (hasInternship) strengths.push("Industry exposure through internship experience");
  if (/\d+%|\d+x/.test(text)) strengths.push("Quantifies project impact with metrics");
  const topFramework = technical.find((skill) => skill.category === "framework");
  if (topFramework) strengths.push(`Practical ${topFramework.name} experience`);

  const gaps = [];
  if (!has("DSA")) gaps.push("Data structures and algorithms practice");
  if (!has("System Design")) gaps.push("System design tradeoffs");
  if (!has("DBMS") && !skills.some((skill) => skill.category === "database")) gaps.push("Database fundamentals and indexing");
  if (!/\d+%|\d+x/.test(text)) gaps.push("Quantifying project impact with numbers");
  if (!has("Operating Systems") || !has("Computer Networks")) gaps.push("Core CS fundamentals (OS, networks)");
  gaps.push("Structured behavioral answers (STAR format)");

  return normalize(
    {
      targetRole: role,
      seniority,
      difficulty,
      readinessEstimate: 35 + Math.min(45, depth * 2),
      skills,
      projects,
      experience: [],
      education: [],
      certifications: sectionLines(sections, /certification/).slice(0, 5),
      strengths: strengths.length ? strengths : ["Clear interest in software development"],
      gaps: gaps.slice(0, 4),
      ...heuristicSuggestions(text, sections, skills, projects)
    },
    targetRole
  );
}

export async function analyzeResume(text, targetRole) {
  const ai = await callJson({
    label: "resume-agent",
    system: SYSTEM,
    maxTokens: 3000,
    prompt: `Target role: ${targetRole || "not specified (infer the best fit)"}\n\nReturn JSON with this shape:\n${SHAPE}\n\nResume text:\n"""\n${text}\n"""`
  });

  if (ai) return { profile: normalize(ai, targetRole), generatedBy: aiProvider, raw: ai };
  return { profile: heuristicProfile(text, targetRole), generatedBy: "heuristic", raw: null };
}
