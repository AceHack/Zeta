import itertools, math
tips=[(math.cos(math.radians(90+72*k)), math.sin(math.radians(90+72*k))) for k in range(5)]
chords=[(k,(k+2)%5) for k in range(5)]
def inter(p1,p2,p3,p4):
    x1,y1=p1;x2,y2=p2;x3,y3=p3;x4,y4=p4
    d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4); a=x1*y2-y1*x2; b=x3*y4-y3*x4
    return ((a*(x3-x4)-(x1-x2)*b)/d,(a*(y3-y4)-(y1-y2)*b)/d)
pts=list(tips)
for i in range(5):
    for j in range(i+1,5):
        p=inter(tips[chords[i][0]],tips[chords[i][1]],tips[chords[j][0]],tips[chords[j][1]])
        if any(math.dist(p,q)<1e-9 for q in pts): continue
        if max(abs(p[0]),abs(p[1]))<1.001: pts.append(p)
def on(p,a,b): return abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-9
lines=[tuple(sorted(i for i,p in enumerate(pts) if on(p,tips[u],tips[v]))) for (u,v) in chords]
def close(pt):
    """Index of the point matching pt, or None if pt is not one of the 10.

    The None is load-bearing, not an oversight: a candidate symmetry that maps
    a point off the figure is not a symmetry, and the caller relies on exactly
    that -- `if all(p is not None for p in perm)` is what rejects it. Returned
    explicitly so the two exits are both visible.
    """
    for i,q in enumerate(pts):
        if math.dist(pt,q)<1e-7: return i
    return None
syms=set()
for k in range(5):
    for refl in (False,True):
        a=math.radians(72*k); perm=[]
        for (x,y) in pts:
            X,Y=(-x,y) if refl else (x,y)          # reflect across the y-axis (a real symmetry here)
            perm.append(close((X*math.cos(a)-Y*math.sin(a), X*math.sin(a)+Y*math.cos(a))))
        if all(p is not None for p in perm): syms.add(tuple(perm))
syms=list(syms); print("symmetry group order:", len(syms), "(expect 10 = D5)")
# a symmetry must permute the line set
assert all(sorted(tuple(sorted(g[i] for i in l)) for l in lines)==sorted(lines) for g in syms), "not line-preserving"
print("all symmetries preserve the line set: True")

sols=[p for p in set(itertools.permutations([1,2,3,4,5,5,6,7,8,9])) if all(sum(p[i] for i in l)==20 for l in lines)]
def canon(s):
    best=None
    for g in syms:
        t=[0]*10
        for i,gi in enumerate(g): t[gi]=s[i]
        t=tuple(t)
        if best is None or t<best: best=t
    return best
print("raw solutions:", len(sols), "-> inequivalent under D5:", len({canon(s) for s in sols}))

# Lucas parametrization, correct form
bad=0; tested=0
for a in range(1,30):
  for b in range(1,12):
    for c in range(1,12):
      sq=[[a-b, a+b+c, a-c],[a+b-c, a, a-b+c],[a+c, a-b-c, a+b]]
      flat=[x for r in sq for x in r]
      if len(set(flat))!=9 or min(flat)<1: continue
      tested+=1
      rows=[sum(r) for r in sq]; cols=[sum(sq[i][j] for i in range(3)) for j in range(3)]
      dia=[sq[0][0]+sq[1][1]+sq[2][2], sq[0][2]+sq[1][1]+sq[2][0]]
      if len(set(rows+cols+dia))!=1 or rows[0]!=3*a: bad+=1
print(f"Lucas parametrization: {tested} distinct-entry squares tested, violations = {bad}")
print("square sum == 3*centre for all of them:", bad==0)
