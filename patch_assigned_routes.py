import re

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'r') as f:
    content = f.read()

old_code = """          setActiveSessionId(snapshot.sessionId);
          setRouteStatus(snapshot.status || '');
          if (snapshot.status === 'ERROR') {"""

new_code = """          setActiveSessionId(snapshot.sessionId);
          setRouteStatus(snapshot.status || '');
          setAssignedRoutes(prev => prev.map(r => 
            r.sessionId === snapshot.sessionId ? { ...r, status: snapshot.status } : r
          ));
          if (snapshot.status === 'ERROR') {"""

content = content.replace(old_code, new_code)

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'w') as f:
    f.write(content)

