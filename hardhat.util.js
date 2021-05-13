const deployUpgradableContract = async (deployments, from, owner, name, args) => {
  const {deploy} = deployments;
  const instance = await deployments.getOrNull(name);

  await deploy(name, {
    from,
    args,
    log: true,
    proxy: {
      owner,
      proxyContract: 'OpenZeppelinTransparentProxy',
      ...(instance && instance.implementation ? {} : {methodName: 'initialize'})
    },
    estimateGasExtra: 1000000
  });
};

module.exports = {
  deployUpgradableContract
};
