import re

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'r') as f:
    content = f.read()

old_code = """          <button
            onClick={() => {
              setShowHistoryModal(true);
              setHistoryTab('all');
            }}
            className="bg-[var(--glass-surface)] backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-[var(--glass-border)] flex items-center gap-2 hover:bg-[var(--glass-surface-solid)] transition-all"
          >"""

new_code = """          <button
            onClick={() => {
              setShowHistoryModal(true);
              setHistoryTab('all');
              loadRouteHistory();
            }}
            className="bg-[var(--glass-surface)] backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-[var(--glass-border)] flex items-center gap-2 hover:bg-[var(--glass-surface-solid)] transition-all"
          >"""

content = content.replace(old_code, new_code)

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'w') as f:
    f.write(content)

