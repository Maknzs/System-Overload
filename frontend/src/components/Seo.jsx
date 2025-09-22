import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getPublicBaseUrl } from "../config";

const SITE_NAME = "System Overload";
const DEFAULT_DESCRIPTION =
  "Plan your dream team, face clever bots, and compete in System Overload – the fast-paced multiplayer strategy card game.";

function removeManagedTags(selector) {
  const existing = document.head.querySelectorAll(selector);
  existing.forEach((el) => {
    if (el.dataset && el.dataset.seoManaged === "true") {
      el.remove();
    }
  });
}

function setMetaTag(name, content, attr = "name") {
  if (!content) return;
  let element = document.head.querySelector(`meta[${attr}="${name}"][data-seo-managed="true"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, name);
    element.dataset.seoManaged = "true";
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setLinkTag(rel, href) {
  if (!href) return;
  let element = document.head.querySelector(`link[rel="${rel}"][data-seo-managed="true"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    element.dataset.seoManaged = "true";
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function setJsonLd(schema) {
  if (!schema) return;
  const element = document.createElement("script");
  element.type = "application/ld+json";
  element.dataset.seoManaged = "true";
  element.text = JSON.stringify(schema);
  document.head.appendChild(element);
}

export default function Seo({
  title,
  description,
  canonicalPath,
  image,
  noindex = false,
  keywords,
  schema,
  robots,
}) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const computedTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    const computedDescription = description?.trim() || DEFAULT_DESCRIPTION;
    const baseUrl = getPublicBaseUrl();
    const canonicalUrl = canonicalPath
      ? new URL(canonicalPath, baseUrl).toString()
      : new URL(pathname, baseUrl).toString();

    // Clean up any existing managed tags before writing new ones
    removeManagedTags("meta[data-seo-managed='true']");
    removeManagedTags("link[data-seo-managed='true']");
    removeManagedTags("script[type='application/ld+json'][data-seo-managed='true']");

    document.title = computedTitle;

    setMetaTag("description", computedDescription);
    const robotsContent = robots || (noindex ? "noindex, nofollow" : "index, follow");
    setMetaTag("robots", robotsContent);
    const keywordContent = Array.isArray(keywords)
      ? keywords.join(", ")
      : keywords;
    if (keywordContent) setMetaTag("keywords", keywordContent);

    setMetaTag("og:title", computedTitle, "property");
    setMetaTag("og:description", computedDescription, "property");
    setMetaTag("og:type", "website", "property");
    setMetaTag("og:url", canonicalUrl, "property");
    setMetaTag("og:site_name", SITE_NAME, "property");
    if (image) setMetaTag("og:image", new URL(image, baseUrl).toString(), "property");

    setMetaTag("twitter:card", image ? "summary_large_image" : "summary");
    setMetaTag("twitter:title", computedTitle);
    setMetaTag("twitter:description", computedDescription);
    if (image) setMetaTag("twitter:image", new URL(image, baseUrl).toString());

    setLinkTag("canonical", canonicalUrl);

    if (schema) setJsonLd(schema);
  }, [
    title,
    description,
    canonicalPath,
    image,
    noindex,
    keywords,
    schema,
    robots,
    pathname,
  ]);

  return null;
}
