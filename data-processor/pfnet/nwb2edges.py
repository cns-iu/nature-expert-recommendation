import sys

def main():
  input = sys.argv[1]
  output = sys.argv[2]

  with open(output, 'w') as out:
    out.write('source,target,weight\n')
    found_edges = False
    found_nodes = False
    nodes = {}
    for line in open(input):
      row = line.split()
      if line.startswith('id*int'):
        found_edges = False
        found_nodes = True
      elif line.startswith('source*int'):
        found_edges = True
        found_nodes = False
      elif found_nodes and len(row) == 2:
        id,label = line.split()
        nodes[id] = label.strip().replace('"', '')
      elif found_edges and len(row) == 3:
        source,target,weight = line.split()
        out.write(f'{nodes[source]},{nodes[target]},{weight}\n')

if __name__ == "__main__":
  main()
