import java.io.File;

import edu.iu.nwb.preprocessing.pathfindernetworkscaling.mst.MSTPathfinderNetworkScalingComputation;
import edu.iu.nwb.preprocessing.pathfindernetworkscaling.mst.MSTPathfinderNetworkScalingOutputGenerator;
import edu.iu.nwb.util.nwbfile.NWBFileParser;

public class PathfinderNetworkScaling {
  public static void main(String[] args) throws Exception {
    String edgeWeightColumnName = "weight";
    String edgeWeightType = "SIMILARITY";
    String inputData = args[0];
    String outputData = args[1];

    NWBFileParser parser = new NWBFileParser(inputData);
    MSTPathfinderNetworkScalingComputation networkScalingComputation = 
      new MSTPathfinderNetworkScalingComputation(edgeWeightColumnName, edgeWeightType, null);
    parser.parse(networkScalingComputation);

    File outputNWBFile = new File(outputData);
    NWBFileParser outputParser = new NWBFileParser(inputData);
    outputParser.parse(new MSTPathfinderNetworkScalingOutputGenerator(networkScalingComputation, outputNWBFile));
  }
}
