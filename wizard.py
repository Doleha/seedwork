#!/usr/bin/env python3
"""Lightweight terminal setup wizard for org.config.json."""

from __future__ import annotations

import copy
import json
import os
import sys
from typing import Any

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(ROOT, "org.config.json")

DEFAULT_CONFIG: dict[str, Any] = {
    "org": {
        "name": "Your Organization Name",
        "tagline": "One-line description",
        "mission": "Full mission statement",
        "community_served": "Who you serve",
        "founded_year": 2024,
        "ein": "XX-XXXXXXX",
        "state_of_incorporation": "TX",
        "fiscal_year_end": "12-31",
        "website": "https://seedwork.dev",
        "email": "info@yourorg.org",
        "phone": "",
        "address": "",
    },
    "programs": {
        "incubator": {
            "name": "Incubator Program",
            "director_name": "Incubator Program Director",
            "director_contact": "incubator@yourorg.org",
            "score_range": [41, 65],
            "description": "Early-stage founders needing foundational support",
        },
        "accelerator": {
            "name": "Accelerator Program",
            "director_name": "Accelerator Program Director",
            "director_contact": "accelerator@yourorg.org",
            "score_range": [66, 100],
            "description": "Growth-stage founders ready to scale",
        },
    },
    "culture": {
        "language_primary": "English",
        "language_secondary": "Arabic",
        "greetings": {
            "achievement": "Masha'Allah",
            "future_plans": "Insha'Allah",
        },
        "address_male": "Br.",
        "address_female": "Sr.",
        "tone": "Warm, respectful, community-centered",
    },
    "social": {
        "twitter": "",
        "instagram": "",
        "linkedin": "",
        "facebook": "",
        "youtube": "",
    },
    "budget": {
        "fiscal_year": 2025,
        "annual_budget_usd": 0,
    },
}


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_existing_config() -> dict[str, Any]:
    if not os.path.exists(CONFIG_PATH):
        return copy.deepcopy(DEFAULT_CONFIG)

    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
            existing = json.load(handle)
    except (OSError, json.JSONDecodeError):
        print("Warning: existing org.config.json is unreadable. Starting from defaults.")
        return copy.deepcopy(DEFAULT_CONFIG)

    if not isinstance(existing, dict):
        print("Warning: existing org.config.json has an unexpected shape. Starting from defaults.")
        return copy.deepcopy(DEFAULT_CONFIG)

    return deep_merge(DEFAULT_CONFIG, existing)


def prompt_text(label: str, current: str, required: bool = False) -> str:
    while True:
        suffix = f" [{current}]" if current != "" else ""
        value = input(f"{label}{suffix}: ").strip()
        if value:
            return value
        if current != "":
            return current
        if not required:
            return ""
        print("This field is required.")


def prompt_int(label: str, current: int | str) -> int | str:
    while True:
        suffix = f" [{current}]" if current != "" else ""
        raw = input(f"{label}{suffix}: ").strip()
        if raw == "":
            return current
        if raw.isdigit():
            return int(raw)
        print("Enter a whole number.")


def prompt_score_range(label: str, current: list[int]) -> list[int]:
    current_text = f"{current[0]}-{current[1]}"
    while True:
        raw = input(f"{label} [{current_text}]: ").strip()
        if raw == "":
            return current
        parts = raw.replace(" ", "").split("-")
        if len(parts) != 2 or not all(part.isdigit() for part in parts):
            print("Use the format min-max, for example 41-65.")
            continue
        low, high = int(parts[0]), int(parts[1])
        if low < 0 or high > 100 or low > high:
            print("Score ranges must be between 0 and 100, with min <= max.")
            continue
        return [low, high]


def print_section(title: str) -> None:
    print()
    print(f"=== {title} ===")


def main() -> int:
    print("Seedwork")
    print("Organization setup wizard")
    print("Press Enter to keep the current value shown in brackets.")

    config = load_existing_config()

    org = config["org"]
    programs = config["programs"]
    culture = config["culture"]
    social = config["social"]
    budget = config["budget"]

    print_section("Organization")
    org["name"] = prompt_text("Organization name", str(org.get("name", "")), required=True)
    org["tagline"] = prompt_text("Tagline", str(org.get("tagline", "")), required=True)
    org["mission"] = prompt_text("Mission", str(org.get("mission", "")), required=True)
    org["community_served"] = prompt_text("Community served", str(org.get("community_served", "")), required=True)
    org["founded_year"] = prompt_int("Founded year", org.get("founded_year", ""))
    org["ein"] = prompt_text("EIN", str(org.get("ein", "")))
    org["state_of_incorporation"] = prompt_text("State of incorporation", str(org.get("state_of_incorporation", "")))
    org["fiscal_year_end"] = prompt_text("Fiscal year end (MM-DD)", str(org.get("fiscal_year_end", "12-31")), required=True)
    org["website"] = prompt_text("Website", str(org.get("website", "https://seedwork.dev")))
    org["email"] = prompt_text("Email", str(org.get("email", "")))
    org["phone"] = prompt_text("Phone", str(org.get("phone", "")))
    org["address"] = prompt_text("Address", str(org.get("address", "")))

    print_section("Incubator Program")
    incubator = programs["incubator"]
    incubator["name"] = prompt_text("Program name", str(incubator.get("name", "")), required=True)
    incubator["director_name"] = prompt_text("Director name", str(incubator.get("director_name", "")), required=True)
    incubator["director_contact"] = prompt_text("Director contact", str(incubator.get("director_contact", "")), required=True)
    incubator["score_range"] = prompt_score_range("Readiness score range", incubator.get("score_range", [41, 65]))
    incubator["description"] = prompt_text("Program description", str(incubator.get("description", "")), required=True)

    print_section("Accelerator Program")
    accelerator = programs["accelerator"]
    accelerator["name"] = prompt_text("Program name", str(accelerator.get("name", "")), required=True)
    accelerator["director_name"] = prompt_text("Director name", str(accelerator.get("director_name", "")), required=True)
    accelerator["director_contact"] = prompt_text("Director contact", str(accelerator.get("director_contact", "")), required=True)
    accelerator["score_range"] = prompt_score_range("Readiness score range", accelerator.get("score_range", [66, 100]))
    accelerator["description"] = prompt_text("Program description", str(accelerator.get("description", "")), required=True)

    print_section("Culture")
    greetings = culture["greetings"]
    culture["language_primary"] = prompt_text("Primary language", str(culture.get("language_primary", "English")), required=True)
    culture["language_secondary"] = prompt_text("Secondary language", str(culture.get("language_secondary", "")))
    greetings["achievement"] = prompt_text("Achievement phrase", str(greetings.get("achievement", "")))
    greetings["future_plans"] = prompt_text("Future plans phrase", str(greetings.get("future_plans", "")))
    culture["address_male"] = prompt_text("Male address", str(culture.get("address_male", "")))
    culture["address_female"] = prompt_text("Female address", str(culture.get("address_female", "")))
    culture["tone"] = prompt_text("Communication tone", str(culture.get("tone", "")), required=True)

    print_section("Social")
    social["twitter"] = prompt_text("Twitter/X", str(social.get("twitter", "")))
    social["instagram"] = prompt_text("Instagram", str(social.get("instagram", "")))
    social["linkedin"] = prompt_text("LinkedIn", str(social.get("linkedin", "")))
    social["facebook"] = prompt_text("Facebook", str(social.get("facebook", "")))
    social["youtube"] = prompt_text("YouTube", str(social.get("youtube", "")))

    print_section("Budget")
    budget["fiscal_year"] = prompt_int("Fiscal year", budget.get("fiscal_year", 2025))
    budget["annual_budget_usd"] = prompt_int("Annual budget (USD)", budget.get("annual_budget_usd", 0))

    print()
    print("Configuration summary")
    print(f"- Organization: {org['name']}")
    print(f"- Incubator director: {incubator['director_name']} ({incubator['director_contact']})")
    print(f"- Accelerator director: {accelerator['director_name']} ({accelerator['director_contact']})")
    print(f"- Output file: {CONFIG_PATH}")

    confirm = input("Write org.config.json now? [Y/n]: ").strip().lower()
    if confirm in {"n", "no"}:
        print("Aborted. No changes were written.")
        return 1

    with open(CONFIG_PATH, "w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2)
        handle.write("\n")

    print(f"Wrote {CONFIG_PATH}")
    print("Next steps:")
    print("  1. Review org.config.json if needed")
    print("  2. cp .env.example .env")
    print("  3. Fill in .env")
    print("  4. bash scripts/download-model.sh")
    print("  5. ./setup.sh")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except EOFError:
        print("\nCancelled: no interactive input available.")
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("\nCancelled.")
        raise SystemExit(130)
