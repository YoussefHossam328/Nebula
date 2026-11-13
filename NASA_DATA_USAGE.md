# NASA data research and proposed usage

Research date: 2026-11-13. Status: research verified; no new NASA integration has been implemented in the game.

## Credential handling

The personal API key supplied in chat has **not been used, saved, committed or embedded in the app**. Research used the public `DEMO_KEY`. No key is reproduced in these documents. Proposed future credential: GitHub Actions secret `NASA_API_KEY` for bounded data refresh requests; no credential is included in generated/public fixtures. This secret has not been configured by this planning task.

## Verified sources and requests

### DONKI solar energetic particle events

Request: `GET https://api.nasa.gov/DONKI/SEP?startDate=2024-05-10&endDate=2024-05-12&api_key=DEMO_KEY`.

Observed: HTTP 200; six event records. Example identifier: `2024-05-10T12:59:00-SEP-001`, event time `2024-05-10T12:59Z`, instrument `SOHO: COSTEP 15.8-39.8 MeV`. The response included a DONKI source link and associated flare IDs.

This confirms API access and event metadata, **not** Mars surface-dose measurements. The example instrument/location must not be relabeled as Curiosity or Mars. No event fixture was added to gameplay during planning.

Proposed use: event context, identifiers, instrument metadata, original times, links and associations. Select records relevant to the scenario and preserve their location. Do not derive mGy/hour from flare class or an event flag.

### Curiosity RAD archive

Archive: https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/

Readme: https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/AAREADME.TXT

Both returned HTTP 200. The readme describes RAD data from interplanetary cruise and the surface mission; RDR products are NASA Level 1A mirroring raw instrument data. This is not evidence of an already parsed calibrated dose series. The documents directory was accessible; an attempted DATA directory read returned 503, and a guessed `CATALOG/DATASET.CAT` path returned 404. Neither failed read was treated as successful extraction.

Proposed use: identify correct processed product, instrument target/quantity, units, quality flags, calibration and uncertainty before extracting a reference curve. If this is impractical, use an explicitly documented published reference rather than inventing a processing pipeline.

### NASA/JPL May 2024 Mars solar-storm report

Source: https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/

Observed: HTTP 200. The article describes the May 20, 2024 event and reports an 8,100 microgray dose near Curiosity, describing it as not deadly. Conversion: `8,100 µGy = 8.1 mGy`. It discusses the distinction between flare photons and energetic particles and Mars surface shielding opportunities.

Proposed use: historical scenario anchor and attribution. The total alone is not a timestamped dose-rate curve. A reconstructed profile must be labeled and normalized to the correct integrated quantity, with background inclusion checked. Do not convert directly to mSv or an instantaneous lethal threshold.

## Implementation record to add after approval

Record endpoint and date range (without credentials), retrieval time, response status, selected event IDs, instrument/location, exact reference interval, units, conversion steps, calibration/background treatment, reconstruction/scaling, shielding assumptions, validation tests and bundled fixture version/checksum. Document whether an API request was made by CI or the browser. Never call archived observations live.

Public API index: https://api.nasa.gov/

These notes distinguish what was actually checked from proposed future work. They do not claim that the supplied key was tested or that dose data is already integrated.

## Implementation update

The seven-sol implementation now includes `scripts/refresh-nasa.py`. Actual request: DONKI SEP from **2024-05-10 through 2024-05-21**, using public DEMO_KEY during development; returned **12 records**. The response was reduced to IDs, original times, instruments, associations and source URLs in `src/data/donki-context.json`, with retrieval time. No key is included. This archive includes non-Mars instruments and supplies context only; it is not evidence that those instruments recorded the May 20 surface dose.

CI refreshes this bounded historical context before builds on main/manual runs. `NASA_API_KEY` is optional through GitHub Actions secrets; absent a binding, DEMO_KEY is used. No personal key from chat has been stored or tested. A failed refresh retains existing archived metadata and timestamps; no static data is presented as live.

NASA NTRS search for DOI `1244797` returned record **20180007641**, title _Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover_. Record lookup succeeded and identified the Science publication (343, 6169; 2014-01-24). The record is metadata-only and has no downloadable PDF. The model uses the published RAD plastic-detector/tissue-reference background value of **0.21 mGy/day**; this is a literature reference rather than a newly processed PDS observation series. Its reference epoch is not the scenario's current weather.

The implemented radiation model uses that baseline plus a **reconstructed**, analytically integrated triangular profile anchored to the NASA/JPL reported **8.1 mGy** event total. It assumes the total includes background over the chosen eight-hour reconstructed interval and subtracts modeled background from the transient integral to avoid counting it twice. The event duration/curve and shelter transmission factors are assumptions. The 5 mGy operational loss limit is not a medical-lethality threshold. See `src/base/model.ts` and tests proving the event-window outdoor integral is 8.1 mGy.

No gy-to-sievert conversion, flare-class-to-dose conversion, real-time Mars forecast or raw RAD calibration pipeline is implemented. Original NASA source links and assumptions are visible in the top-right Sources category.
