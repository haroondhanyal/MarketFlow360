"use client";
import { useEffect, useState } from "react";

const themes = [
  ["graphite-dark", "Graphite Dark"],
  ["graphite-modern", "Midnight Charcoal"],
  ["contrast-black", "High Contrast Black"],
  ["soft-gray-light", "Soft Gray Light"],
];
const fonts = [
  ["clean-ui", "Clean UI"],
  ["modern-sans", "Modern Sans"],
  ["developer-mono", "Developer Mono"],
];

function applyAppearance(theme: string, font: string) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.font = font;
}
function persistAppearance(theme: string, font: string) {
  applyAppearance(theme, font);
  localStorage.setItem("mf_theme", theme);
  localStorage.setItem("mf_font", font);
}

function migrateTheme(theme: string) {
  return ({ "vscode-dark-plus": "graphite-dark", "vscode-dark-modern": "graphite-modern", "vscode-high-contrast": "contrast-black", "vscode-light-modern": "soft-gray-light" } as Record<string,string>)[theme] ?? theme;
}
function migrateFont(font: string) {
  return ({ vscode: "clean-ui", modern: "modern-sans", mono: "developer-mono" } as Record<string,string>)[font] ?? font;
}

export function AppearanceSettings() {
  const [theme, setTheme] = useState("soft-gray-light");
  const [font, setFont] = useState("clean-ui");
  const [savedTheme, setSavedTheme] = useState("soft-gray-light");
  const [savedFont, setSavedFont] = useState("clean-ui");
  useEffect(() => {
    const theme = migrateTheme(localStorage.getItem("mf_theme") || "soft-gray-light");
    const font = migrateFont(localStorage.getItem("mf_font") || "clean-ui");
    setTheme(theme); setFont(font); setSavedTheme(theme); setSavedFont(font);
    persistAppearance(theme, font);
  }, []);
  function save() {
    persistAppearance(theme, font);
    setSavedTheme(theme); setSavedFont(font);
  }
  const dirty = theme !== savedTheme || font !== savedFont;
  return <section className="panel appearance-settings"><div><h2>Appearance</h2><p>Choose a color theme and interface font. Preview changes immediately, then save them on this device.</p></div><label>Color theme<select value={theme} onChange={e => { const value=e.target.value; setTheme(value); applyAppearance(value,font); }}>{themes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Interface font<select value={font} onChange={e => { const value=e.target.value; setFont(value); applyAppearance(theme,value); }}>{fonts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="appearance-save"><button className="primary" type="button" onClick={save}>Apply and Save</button><small aria-live="polite">{dirty?"Preview active · not saved":`Saved · ${themes.find(([key])=>key===savedTheme)?.[1]??"Theme"}`}</small></div></section>;
}
