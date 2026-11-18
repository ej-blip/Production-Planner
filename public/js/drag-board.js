// Shared drag-and-drop for name boards (who's in, bench assignments).
//
// Markup the board owner renders:
//   zones:  any element with class "zone" and data-zone="<zone id>"
//   names:  any element with class "chip", data-staff="<staff key>" and
//           data-zone="<zone it's in>"; add class "selected" when
//           board.selected matches it.
//
// People can drag a name with a mouse or finger onto a zone, or tap a name
// and then tap a zone. onMove(staffKey, fromZone, toZone) is called for
// every move onto a different zone. While a drag is in progress the owner
// should hold off re-rendering (check board.isDragging()); onDragEnd() is
// called when it's safe again.
(function () {
  "use strict";

  function attachDragBoard(root, options) {
    const { onMove, onSelect = () => {}, onDragStart = () => {}, onDragEnd = () => {}, isBusy = () => false } = options;
    let drag = null;
    let selected = null;
    let ignoreClickUntil = 0;

    const zoneAt = (x, y) => {
      const zone = document.elementFromPoint(x, y)?.closest(".zone[data-zone]") || null;
      return zone && root.contains(zone) ? zone : null;
    };
    const clearTargets = () => root.querySelectorAll(".zone.drop-target")
      .forEach(zone => zone.classList.remove("drop-target"));
    const select = next => {
      selected = next;
      onSelect(selected);
    };
    const move = (staffKey, from, to) => {
      select(null);
      if (to && to !== from) onMove(staffKey, from, to);
    };

    root.addEventListener("pointerdown", event => {
      const chip = event.target.closest(".chip[data-staff]");
      if (!chip || !root.contains(chip) || isBusy()) return;
      drag = {
        chip,
        staffKey: chip.dataset.staff,
        from: chip.dataset.zone,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        ghost: null
      };
      chip.setPointerCapture(event.pointerId);
    });

    root.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.ghost && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) {
        drag.ghost = drag.chip.cloneNode(true);
        drag.ghost.classList.add("ghost");
        drag.ghost.classList.remove("selected");
        document.body.appendChild(drag.ghost);
        onDragStart(drag.staffKey, drag.from);
      }
      if (!drag.ghost) return;
      drag.ghost.style.left = `${event.clientX - drag.ghost.offsetWidth / 2}px`;
      drag.ghost.style.top = `${event.clientY - drag.ghost.offsetHeight / 2}px`;
      clearTargets();
      zoneAt(event.clientX, event.clientY)?.classList.add("drop-target");
    });

    const finish = (event, cancelled) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const current = drag;
      drag = null;
      if (current.ghost) {
        current.ghost.remove();
        const zone = cancelled ? null : zoneAt(event.clientX, event.clientY);
        clearTargets();
        onDragEnd();
        if (zone) move(current.staffKey, current.from, zone.dataset.zone);
        return;
      }
      onDragEnd();
      if (cancelled) return;
      // A tap selects (or unselects) this person.
      const same = selected?.staffKey === current.staffKey && selected?.from === current.from;
      // The click that follows this tap can land on the zone once the board
      // redraws; ignore it so the tap doesn't count as "move here".
      ignoreClickUntil = performance.now() + 250;
      select(same ? null : { staffKey: current.staffKey, from: current.from });
    };

    root.addEventListener("pointerup", event => finish(event, false));
    root.addEventListener("pointercancel", event => finish(event, true));

    // With someone selected, tapping a zone (not a name) moves them there.
    root.addEventListener("click", event => {
      if (event.target.closest(".chip") || performance.now() < ignoreClickUntil) return;
      const zone = event.target.closest(".zone[data-zone]");
      if (!zone || !root.contains(zone) || !selected || isBusy()) return;
      move(selected.staffKey, selected.from, zone.dataset.zone);
    });

    return {
      get selected() { return selected; },
      isDragging: () => Boolean(drag?.ghost),
      clearSelection: () => select(null)
    };
  }

  window.attachDragBoard = attachDragBoard;
})();
