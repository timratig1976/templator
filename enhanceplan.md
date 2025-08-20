MVP AI Flow – Schrittweiser Implementierungsplan (Windsurf Briefing)
Kontext & Zielsetzung

Dieses Dokument dient als Implementierungs- und Kommunikationsplan für den Aufbau des MVP AI-basierten Workflows mit RAG-Unterstützung. Ziel ist es, eine einfach erweiterbare Basis ausschließlich mit Postgres zu schaffen, die Ground Truth, Logging, IR-Schemas, Metriken und Human-in-the-Loop Feedback unterstützt.

Wichtig: Die hier beschriebenen Schritte greifen auf die bereits vorhandenen Tabellen, UI-Komponenten und Metrik-Funktionalitäten zurück. Alle Anpassungen erfolgen modular und rückwärtskompatibel, ohne bestehende Projektteile zu zerstören. Postgres ist die Single-Source-of-Truth, später können zusätzliche Systeme (z. B. S3, TimescaleDB, Redis) einfach angedockt werden.

Kommunikationshinweis

Betone, dass Postgres für das MVP ausreicht – alles ist an einem Ort, Backups sind simpel, und Erweiterungen sind vorbereitet.

Kommuniziere klar, dass bestehende Datenstrukturen nicht ersetzt, sondern ergänzt werden.

Heb hervor, dass IR-Schemas, Metriken und Logging in dedizierten Tabellen leben und bestehende Prozesse nicht überschreiben.

Unterstreiche, dass wir eine stabile, modulare Grundlage schaffen, die leicht zu erweitern ist.

Schritt-für-Schritt Plan
Phase 1: Postgres Setup

pgvector-Extension aktivieren (für Embeddings/RAG).

Optionale UUID-Extension (gen_random_uuid()).

Migrationen vorbereiten → nur additiv, keine Breaking Changes.

Phase 2: Zentrale Tabellen

ai_steps → Definition der einzelnen Prozessschritte.

ai_step_runs → Logging jeder Ausführung (Inputs, Outputs, Status).

ir_schema_definitions → JSON-Schemas pro Step.

metrics_definitions → Definition der Qualitätsmetriken.

metrics_results → Ergebnisse der Berechnung pro Run.

human_feedback → Feedback der Nutzer (Korrekturen, Labels, Bewertungen).

ground_truth → Gold-Standard-Daten für Evaluierungen.

embeddings → Vektor-Speicher für RAG.

Phase 3: Orchestrierung

FastAPI als Orchestrator behalten.

Jeder Step ruft über Worker/Task-Logik das LLM oder RAG ab.

Ergebnisse werden in ai_step_runs protokolliert.

Phase 4: IR-Schema & Validierung

Backend erlaubt Definition des gewünschten IR-Outputs (JSON Schema).

Jeder Run wird gegen Schema validiert.

Validierte Outputs → gespeichert für Metrikberechnung.

Phase 5: Metriken & Evaluation

Metriken (z. B. Genauigkeit, Vollständigkeit, Konsistenz) in metrics_definitions anlegen.

Automatische Berechnung nach jedem Run.

Ergebnisse in metrics_results sichern.

Phase 6: Human-in-the-Loop (HiTL)

UI-Feedback an human_feedback loggen.

Feedback kann Ground Truth ergänzen oder neue Prompt-Versionen steuern.

Phase 7: Monitoring

Logging in Postgres halten.

Später Anbindung an Prometheus/Grafana möglich.

Nächste Schritte

Tabellen-Schema in Postgres aufsetzen.

Dummy-IR-Schema + Dummy-Metriken einfügen.

Erste Pipeline (z. B. Retrieval + Generate) End-to-End durchspielen.