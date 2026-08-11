/**
 * usePortfolioData — Custom React hook
 * Fetches all portfolio data from Supabase in real-time.
 * Falls back to static constants.js data if Supabase is not configured.
 */

import { useState, useEffect } from "react";
import {
  SkillsInfo as staticSkills,
  experiences as staticExperiences,
  education as staticEducation,
  projects as staticProjects,
} from "../constants";

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

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
      setData(d => ({ ...d, loading: false }));
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const [projects, experience, education, skillsCats, about] = await Promise.all([
          fetchSection(supabase, "projects"),
          fetchSection(supabase, "experience"),
          fetchSection(supabase, "education"),
          fetchSection(supabase, "skills"),
          fetchSingleton(supabase, "about/main"),
        ]);

        // Convert skills to SkillsInfo format
        const skills = skillsCats.map(cat => ({
          title: cat.title,
          skills: (cat.skills || []).map(s => ({ name: s.name, logo: s.logo || "" })),
        }));

        if (!cancelled) {
          setData({ projects, experience, education, skills, about, loading: false, fromSupabase: true });
        }
      } catch (err) {
        console.warn("[Portfolio] Supabase fetch failed, using static data:", err.message);
        if (!cancelled) setData(d => ({ ...d, loading: false }));
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  return data;
}
