import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const distDir = path.resolve(process.cwd(), "dist");

const ENTRY_HTML_FILES = [
  "index.html",
  "login.html",
  "setup.html",
  "reset-request.html",
  "reset-complete.html",
  "confirm-email.html",
  "profile.html",
  "admin.html",
];

describe("PWA build output", () => {
  describe("Web App Manifest", () => {
    it("manifest.webmanifest exists in dist", () => {
      expect(fs.existsSync(path.join(distDir, "manifest.webmanifest"))).toBe(true);
    });

    it("manifest.webmanifest is valid JSON", () => {
      const raw = fs.readFileSync(path.join(distDir, "manifest.webmanifest"), "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it("manifest has required name field", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(distDir, "manifest.webmanifest"), "utf-8")
      );
      expect(manifest.name).toBeTruthy();
    });

    it("manifest has required short_name field", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(distDir, "manifest.webmanifest"), "utf-8")
      );
      expect(manifest.short_name).toBeTruthy();
    });

    it("manifest has start_url", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(distDir, "manifest.webmanifest"), "utf-8")
      );
      expect(manifest.start_url).toBeDefined();
    });

    it("manifest has display: standalone", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(distDir, "manifest.webmanifest"), "utf-8")
      );
      expect(manifest.display).toBe("standalone");
    });

    it("manifest has at least two icon entries", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(distDir, "manifest.webmanifest"), "utf-8")
      );
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Icon files", () => {
    it("icon-192.png exists in dist/icons/", () => {
      expect(fs.existsSync(path.join(distDir, "icons", "icon-192.png"))).toBe(true);
    });

    it("icon-512.png exists in dist/icons/", () => {
      expect(fs.existsSync(path.join(distDir, "icons", "icon-512.png"))).toBe(true);
    });

    it("all icon paths referenced in manifest exist in dist", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(distDir, "manifest.webmanifest"), "utf-8")
      );
      for (const icon of manifest.icons) {
        const iconPath = path.join(distDir, icon.src.replace(/^\//, ""));
        expect(fs.existsSync(iconPath), `Icon not found: ${icon.src}`).toBe(true);
      }
    });
  });

  describe("Service Worker", () => {
    it("sw.js exists in dist", () => {
      expect(fs.existsSync(path.join(distDir, "sw.js"))).toBe(true);
    });
  });

  describe("HTML entry points", () => {
    for (const htmlFile of ENTRY_HTML_FILES) {
      it(`${htmlFile} contains service worker registration script`, () => {
        const filePath = path.join(distDir, htmlFile);
        expect(fs.existsSync(filePath), `HTML file not found: ${htmlFile}`).toBe(true);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).toMatch(/registerSW|workbox|sw\.js/);
      });
    }
  });

  describe("iOS Home Screen (US3)", () => {
    for (const htmlFile of ENTRY_HTML_FILES) {
      it(`${htmlFile} contains apple-touch-icon link`, () => {
        const filePath = path.join(distDir, htmlFile);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).toContain('rel="apple-touch-icon"');
      });

      it(`${htmlFile} contains apple-mobile-web-app-capable meta tag`, () => {
        const filePath = path.join(distDir, htmlFile);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).toContain("apple-mobile-web-app-capable");
      });
    }
  });
});
