w = 30
h = 17.32
v = 80 # total height of leg
vc = 25 # crossbar height
v_gap_bot = 25 # gap below crossbar
v_gap_top = 30 # gap above crossbar
# wait, v_gap_bot + vc + v_gap_top = 25 + 25 + 30 = 80 = v.

def p(i, j, z):
    # i is down-left steps
    # j is down-right steps
    # z is absolute vertical offset (pixels)
    x = 100 - i * w + j * w
    y = 150 + i * h + j * h - z
    return (x, y)

# Let's map the faces.
# Left Leg: base is i=0 to 1, j=0 to -1.
# Actually, let's use i,j as the coordinate of the FRONT vertex of a column.
# Column center:
# Left column front vertex: i=1, j=0
# Right column front vertex: i=0, j=1
# Crossbar front vertex: i=0, j=0

# Let's just define vertices by their logical position.
# Top-Left point of Left Leg:
# Left leg spans x from 40 to 100?
# Let's write raw coordinates.
C = (100, 110) # center of crossbar bottom front vertex.
# Top diamond floating:
pts = {}
pts["T_top"] = (100, 12)
pts["T_left"] = (70, 12 + 17.32)
pts["T_bot"] = (100, 12 + 34.64)
pts["T_right"] = (130, 12 + 17.32)

# Left Leg Top Diamond:
pts["LLT_top"] = (70, 35)
pts["LLT_left"] = (40, 35 + 17.32)
pts["LLT_bot"] = (70, 35 + 34.64)
pts["LLT_right"] = (100, 35 + 17.32)

# Right Leg Top Diamond:
pts["RLT_top"] = (130, 35)
pts["RLT_left"] = (100, 35 + 17.32)
pts["RLT_bot"] = (130, 35 + 34.64)
pts["RLT_right"] = (160, 35 + 17.32)

# Crossbar Top Diamond:
pts["CT_top"] = (100, 75)
pts["CT_left"] = (70, 75 + 17.32)
pts["CT_bot"] = (100, 75 + 34.64)
pts["CT_right"] = (130, 75 + 17.32)

# Left Leg Front-Left Face:
pts["LLFL_1"] = pts["LLT_left"]
pts["LLFL_2"] = pts["LLT_bot"]
pts["LLFL_3"] = (pts["LLT_bot"][0], pts["LLT_bot"][1] + 100)
pts["LLFL_4"] = (pts["LLT_left"][0], pts["LLT_left"][1] + 100)

# Left Leg Front-Right Face (above crossbar):
pts["LLFR_T1"] = pts["LLT_bot"]
pts["LLFR_T2"] = pts["LLT_right"]
pts["LLFR_T3"] = pts["CT_left"]
pts["LLFR_T4"] = (pts["LLT_bot"][0], pts["CT_left"][1] + 17.32)

# This is getting messy to do in python without visual feedback.
