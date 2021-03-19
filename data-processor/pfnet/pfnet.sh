#!/bin/bash
set -e

THIS="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
plugins=$THIS/plugins
JCP=${plugins}/edu.iu.nwb.preprocessing.pathfindernetworkscaling.mst_1.0.0.jar:${plugins}/org.eclipse.osgi_3.7.0.v20110613.jar:${plugins}/edu.iu.nwb.util_1.2.0.jar:${THIS}

if [ ! -e $THIS/PathfinderNetworkScaling.class ];
then
  pushd $THIS
    javac -cp $JCP PathfinderNetworkScaling.java
  popd
fi

if [ -f "$1" ]; then
  python $THIS/edges2nwb.py $1 ${1}.nwb
  java -cp $JCP PathfinderNetworkScaling ${1}.nwb ${2}.nwb
  python $THIS/nwb2edges.py ${2}.nwb $2
fi
