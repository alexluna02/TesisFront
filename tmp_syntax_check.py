from pathlib import Path
from collections import Counter
p = Path('D:/ProyectoTesis/FrontReactIA/src/App.jsx')
code = p.read_text(encoding='utf8')
count = Counter(code)
print({c: count[c] for c in '(){}[]'})
pairs = {')': '(', '}': '{', ']': '['}
stack = []
for i, ch in enumerate(code, 1):
    if ch in '({[':
        stack.append((ch, i))
    elif ch in ')}]':
        if stack and stack[-1][0] == pairs[ch]:
            stack.pop()
        else:
            print('mismatch', ch, 'at', i, 'stack', stack[-5:])
            break
else:
    print('stack len', len(stack))
    if stack:
        print(stack[-10:])
