def point(x, y):
    # Base isometric projection
    # origin 100, 110
    # x axis goes down-left
    # y axis goes down-right
    # z axis goes up
    # However, to easily trace a 2D isometric grid:
    # let dx = 30, dy = 17.32 (approx 30*sin(30) = 15... let's use exact)
    pass

# We will just write a python script to generate the SVG exactly.
# Yellow shape:
# A single polygon.
pts_yellow = [
    (40, 60),
    (70, 43),
    (70, 83),
    (100, 66),
    (100, 106),
    (70, 123),
    (70, 163),
    (40, 180)
]
pts_cyan = [
    (160, 60),
    (160, 180),
    (130, 163),
    (130, 123),
    (100, 106),
    (100, 66),
    (130, 83),
    (130, 43)
]
top_diamond = [
    (100, 26),
    (115, 34.5),
    (100, 43),
    (85, 34.5)
]

def to_path(pts):
    return "M" + " L".join(f"{x} {y}" for x, y in pts) + " Z"

print(f'<path d="{to_path(pts_yellow)}" fill="#D4D916"/>')
print(f'<path d="{to_path(pts_cyan)}" fill="#00B4D8"/>')
print(f'<path d="{to_path(top_diamond)}" fill="#D4D916"/>')

