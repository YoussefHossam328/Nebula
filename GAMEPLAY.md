# Nebula player build

Open the normal Pages URL for the Nebula title screen. Play begins isolated, action-led training; Start challenge begins a fresh seven-sol run. Escape pauses. The loss/victory screen offers tutorials, a fresh challenge, or the menu.

## Controls and learning

WASD/arrows move, Shift runs, Space jumps, C crouches, E operates nearby equipment. Hold E by the cyan solar service ring to clean; releasing cancels. The solar service range also includes the mast so existing approaches work. E at the green habitat crop beds eats one ready portion and replants that bed. E at the oxygen plant toggles its load. E at the blue beacon sends a report; its reply arrives after eight simulated minutes, a teaching assumption rather than a live Earth–Mars distance calculation.

Tutorials cover movement, sunlight/storage, panel cleaning, oxygen, food, shelter and communications individually. Supplies reset between lessons and before the main mission. Dialogue pauses survival time. Tutorial food/oxygen safety floors prevent supplies running out while practicing. No voiceover or story cutscenes are included.

## Supplies and local events

Nourishment starts at 80, drains 25 points per sol, and meals restore 35 up to 100. Two beds begin ready. Harvests automatically replant; each bed needs one powered sol to regrow. Growing beds share a 400 W load, after essential base and oxygen loads. Growth stops when that load cannot be served. Crop speed and nourishment are gameplay assumptions, not NASA botanical measurements.

The deterministic calendar has an early dust storm, a cold snap, the existing RAD-reference particle event, a recovery period and a later dust storm before the final sol. Weather warnings precede dust/cold. Dust reduces sunlight; cold adds heating demand. Particle exposure uses the existing integrated dose curve. No live API calls or API key are needed for play or deployment. Archived source records and model caveats remain under Base / Sources.

The prominent Stress bar is fictional and recoverable inside the storm shelter. Recorded physical dose in mGy never decreases; shelter reduces new dose. Reaching the configurable operational dose cap ends the run, not a claim about a lethal human dose. Food or oxygen depletion also ends the run.

## Debug and settings

Use the top-right Debug / settings button. This opens the single existing categorized settings window and pauses play. Trigger dust/cold/particles, clear events, mature crops, restore food, or restart training/challenge in Mission / events and crops. Event commands while paused take effect when resumed. These runs show DEBUG. Crop balance and the weather calendar have editable fields with descriptions. The existing Base settings use Apply and restart; movement and camera remain live tuning controls. Open legacy laboratory uses `?lab` for the original regression scenarios.

## Assets and sound

`public/models/Lander.glb` is the supplied lander. Its world bounds are fitted to four metres, centered and grounded on a simple pad next to the habitat. A fixed body collider is a blockout, not detailed collision against the door or legs. It has no authored animation clips. Crops and pad are replaceable placeholder meshes.

The default sound design is original Web Audio synthesis: smoothed noise grains for steps/landings and a subdued wind loop, plus a short sine alert when the event status changes. It uses no NASA recordings and no external generation service. The previous user-supplied WAVs remain in the repository but are no longer the default. Master, ambience and effects gains remain editable. Menus/pause mute the scene; shelter attenuates ambience. Playback unlocks after a user gesture.

No external photographs are included in this iteration; curated NASA-only images remain optional. Cutscenes, story, mobile touch controls and full mission save/load remain deferred. Browser viewport tests do not certify 60 FPS on physical phones.

## Supplied three-room base

The normal game now uses the supplied `public/models/Base.glb`, with its reference astronaut removed at runtime. The source file is preserved. The rooms hold a furnished command/living area, an oxygen utility room and two powered crop beds. Building panels use warm neutral materials; floors, signs, lockers, bedding, telemetry displays, supply crates, a nutrient reservoir and grow-light housing provide prototype decoration. Crops use low-poly stems/leaves and retain the existing growth/harvest behavior.

The export has no roof and its building meshes have no assigned texture material. Runtime shell preparation adds a south doorway and opens the farm approach, then builds matching Rapier triangle collision. The bunk sits clear of the connecting passage. The roofless layout stays roofless; the station cutaway setting fades walls when inside. Equipment anchors in `src/layout.ts` are shared with prompts, harvesting and oxygen interaction. The array moves outside the larger base footprint. Legacy `?lab` exercises retain the original station and equipment positions.
