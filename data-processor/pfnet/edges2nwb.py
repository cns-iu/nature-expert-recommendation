import sys

def main():
  input = sys.argv[1]
  output = sys.argv[2]

  with open(output, 'w') as out:
    out.write('*Nodes\nid*int\tlabel*string\n')
    nodes = {}
    node_id = 0
    has_weight = False
    for line in open(input):
      row = line.split()
      if len(row) == 3:
        has_weight = True
      source,target = row[0:2]
      if source not in nodes:
        node_id += 1
        nodes[source] = node_id
        out.write(f'{node_id} "{source}"\n')
      if target not in nodes:
        node_id += 1
        nodes[target] = node_id
        out.write(f'{node_id} "{target}"\n')
    out.write('*UndirectedEdges\nsource*int\ttarget*int\tweight*float\n')
    if has_weight:
      for line in open(input):
        source,target,weight = line.split()[0:3]
        out.write(f'{nodes[source]}\t{nodes[target]}\t{weight.strip()}\n')
    else:
      for line in open(input):
        source,target = line.split()[0:2]
        out.write(f'{nodes[source]}\t{nodes[target]}\t1\n')

if __name__ == "__main__":
  main()
