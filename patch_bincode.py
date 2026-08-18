import re

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'r') as f:
    content = f.read()

# We replace <span>{entry?.data.binCode || id}</span>
old_span = "<span>{entry?.data.binCode || id}</span>"
new_span = "<span>Bin: #{id}</span>"

content = content.replace(old_span, new_span)

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'w') as f:
    f.write(content)

