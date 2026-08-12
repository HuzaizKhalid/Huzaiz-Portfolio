/**
 * usePortfolioData — Custom React hook
 * Fetches all portfolio data from Supabase in real-time.
 * Falls back to static constants.js data if Supabase is not configured.
 *
 * LOGO / IMAGE STRATEGY
 * ─────────────────────
 * The admin panel never uploads logos for skills / education / experience
 * (those are local bundled PNG/JPG assets in src/assets/).
 *
 * Resolution priority:
 *  1. If the field is a valid https URL → use it (user explicitly uploaded something)
 *  2. Otherwise → look up by name in a pre-built map from the static constants
 *  3. If still not found → fall back to the first matching static entry
 */

import { useState, useEffect } from "react";
import {
  SkillsInfo as staticSkills,
  experiences as staticExperiences,
  education as staticEducation,
  projects as staticProjects,
} from "../constants";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

const isValidUrl = (v) =>
  typeof v === "string" && /^https?:\/\//i.test(v.trim());

const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Static lookup maps ───────────────────────────────────────────────────────

// Skill: normalized name → local logo
const SKILL_LOGO = {};
staticSkills.forEach((cat) =>
  cat.skills.forEach((s) => {
    if (s.name && s.logo) SKILL_LOGO[normalize(s.name)] = s.logo;
  })
);

// Experience: normalized company → static entry (for img + fallback data)
const EXP_BY_COMPANY = {};
staticExperiences.forEach((e) => {
  if (e.company) EXP_BY_COMPANY[normalize(e.company)] = e;
});

// Education: normalized school → static entry
const EDU_BY_SCHOOL = {};
staticEducation.forEach((e) => {
  if (e.school) EDU_BY_SCHOOL[normalize(e.school)] = e;
});

// ── Logo resolution ──────────────────────────────────────────────────────────

function resolveSkillLogo(name, logo) {
  if (isValidUrl(logo)) return logo;
  return SKILL_LOGO[normalize(name)] || "";
}

function resolveExpImg(company, img) {
  if (isValidUrl(img)) return img;
  // Try exact normalized match first
  const exact = EXP_BY_COMPANY[normalize(company)];
  if (exact?.img) return exact.img;
  // Fuzzy: find any static entry whose company name is contained in the Supabase name
  const key = normalize(company);
  const fuzzy = Object.entries(EXP_BY_COMPANY).find(
    ([k]) => key.includes(k) || k.includes(key)
  );
  return fuzzy?.[1]?.img || "";
}

function resolveEduImg(school, img) {
  if (isValidUrl(img)) return img;
  const exact = EDU_BY_SCHOOL[normalize(school)];
  if (exact?.img) return exact.img;
  const key = normalize(school);
  const fuzzy = Object.entries(EDU_BY_SCHOOL).find(
    ([k]) => key.includes(k) || k.includes(key)
  );
  return fuzzy?.[1]?.img || "";
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchSection(supabase, section) {
  const { data, error } = await supabase
    .from("portfolio_data")
    .select("*")
    .eq("section", section)
    .order("order", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, ...row.data, order: row.order }));
}

async function fetchSingleton(supabase, key) {
  const { data, error } = await supabase
    .from("portfolio_singleton")
    .select("value")
    .eq("key", key)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data?.value ?? null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePortfolioData() {
  const [data, setData] = useState({
    projects:     staticProjects,
    experience:   staticExperiences,
    education:    staticEducation,
    skills:       staticSkills,
    about:        null,
    loading:      true,
    fromSupabase: false,
  });

  useEffect(() => {
    if (!isConfigured()) {
      setData((d) => ({ ...d, loading: false }));
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const [rawProjects, rawExp, rawEdu, rawSkills, about] =
          await Promise.all([
            fetchSection(supabase, "projects"),
            fetchSection(supabase, "experience"),
            fetchSection(supabase, "education"),
            fetchSection(supabase, "skills"),
            fetchSingleton(supabase, "about/main"),
          ]);

        // ── Skills: always resolve logos from static map by skill name ──────
        const skills =
          rawSkills.length > 0
            ? rawSkills.map((cat) => ({
                ...cat,
                skills: (cat.skills || []).map((s) => ({
                  ...s,
                  logo: resolveSkillLogo(s.name, s.logo),
                })),
              }))
            : staticSkills;

        // ── Experience: resolve img by company name (fuzzy match) ────────────
        const experience =
          rawExp.length > 0
            ? rawExp.map((e) => ({
                ...e,
                img: resolveExpImg(e.company, e.img),
              }))
            : staticExperiences;

        // ── Education: resolve img by school name (fuzzy match) ──────────────
        const education =
          rawEdu.length > 0
            ? rawEdu.map((e) => ({
                ...e,
                img: resolveEduImg(e.school, e.img),
              }))
            : staticEducation;

        // ── Projects: use Supabase data; image field should be Cloudinary URL ─
        // If the image is missing/broken, fall back to the matching static project
        const PROJECT_IMG = {};
        staticProjects.forEach((p) => {
          if (p.title && p.image) PROJECT_IMG[normalize(p.title)] = p.image;
        });

        const projects =
          rawProjects.length > 0
            ? rawProjects.map((p) => ({
                ...p,
                image: isValidUrl(p.image)
                  ? p.image
                  : PROJECT_IMG[normalize(p.title)] || "",
              }))
            : staticProjects;

        if (!cancelled) {
          setData({
            projects,
            experience,
            education,
            skills,
            about,
            loading: false,
            fromSupabase: true,
          });
        }
      } catch (err) {
        console.warn("[Portfolio] Supabase fetch failed, using static data:", err.message);
        if (!cancelled) setData((d) => ({ ...d, loading: false }));
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  return data;
}
