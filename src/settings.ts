import GUI from "lil-gui";
import { defaults, validate, encode, decode, type Settings } from "./config";
export function panel(
  s: Settings,
  changed: () => void,
  notice: (text: string) => void,
) {
  const gui = new GUI({ title: "Field lab · tuning", width: 290 });
  gui.close();
  const ranges: Record<string, [number, number, number]> = {
    gravity: [0.1, 30, 0.01],
    walk: [0.1, 15, 0.1],
    run: [0.1, 20, 0.1],
    crouchSpeed: [0.1, 10, 0.1],
    acceleration: [0.1, 60, 0.1],
    braking: [0.1, 60, 0.1],
    airControl: [0, 1, 0.01],
    jumpHeight: [0.1, 5, 0.05],
    slope: [1, 80, 1],
    step: [0, 1, 0.01],
    standing: [0.8, 3, 0.05],
    crouching: [0.6, 2, 0.05],
    radius: [0.1, 0.5, 0.01],
    interactionRange: [0.5, 6, 0.1],
    yaw: [-180, 180, 1],
    pitch: [10, 80, 1],
    distance: [3, 30, 0.1],
    fov: [20, 90, 1],
    targetHeight: [0, 3, 0.05],
    smoothing: [0.1, 20, 0.1],
    resolution: [0.5, 2, 0.1],
  };
  let previous = { ...s };
  function commit() {
    try {
      validate(s);
      previous = { ...s };
      changed();
      try {
        localStorage.setItem("nebula.settings", encode(s));
      } catch {
        notice(
          "Settings work, but browser storage is unavailable. Export to keep them.",
        );
      }
    } catch (e) {
      Object.assign(s, previous);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      notice(String(e));
    }
  }
  const groups = [
    [
      "Movement",
      [
        "walk",
        "run",
        "crouchSpeed",
        "acceleration",
        "braking",
        "airControl",
        "jumpHeight",
      ],
    ],
    [
      "Physics · metres / degrees",
      [
        "gravity",
        "slope",
        "step",
        "standing",
        "crouching",
        "radius",
        "interactionRange",
      ],
    ],
    [
      "Camera · degrees / metres",
      ["yaw", "pitch", "distance", "fov", "targetHeight", "smoothing"],
    ],
    ["Rendering", ["resolution", "shadows"]],
  ] as const;
  for (const [name, keys] of groups) {
    const folder = gui.addFolder(name);
    for (const key of keys) {
      if (key === "shadows") folder.add(s, key).onFinishChange(commit);
      else folder.add(s, key, ...ranges[key]).onFinishChange(commit);
    }
    folder.close();
  }
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json";
  file.hidden = true;
  document.body.append(file);
  file.onchange = async () => {
    try {
      const f = file.files?.[0];
      if (f) {
        Object.assign(s, decode(await f.text()));
        commit();
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }
    } catch (e) {
      notice(String(e));
    }
    file.value = "";
  };
  gui
    .add(
      {
        reset() {
          Object.assign(s, defaults);
          commit();
          gui.controllersRecursive().forEach((c) => c.updateDisplay());
        },
      },
      "reset",
    )
    .name("Reset defaults");
  gui
    .add(
      {
        export() {
          const url = URL.createObjectURL(
            new Blob([encode(s)], { type: "application/json" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "nebula-settings.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
      },
      "export",
    )
    .name("Export settings");
  gui
    .add(
      {
        import() {
          file.click();
        },
      },
      "import",
    )
    .name("Import settings");
  gui
    .add(
      {
        low() {
          s.resolution = 0.75;
          s.shadows = false;
          commit();
          gui.controllersRecursive().forEach((c) => c.updateDisplay());
        },
      },
      "low",
    )
    .name("Low quality");
  gui
    .add(
      {
        standard() {
          s.resolution = 1.5;
          s.shadows = true;
          commit();
          gui.controllersRecursive().forEach((c) => c.updateDisplay());
        },
      },
      "standard",
    )
    .name("Standard quality");
}
