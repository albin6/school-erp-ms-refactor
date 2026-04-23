#!/bin/bash
set -e

META_FILE=/var/lib/kafka/data/meta.properties

if [[ -f "$META_FILE" ]]; then
  STORED_CLUSTER_ID="$(awk -F= '/^cluster.id=/{print $2}' "$META_FILE")"
  ZK_CLUSTER_ID="$(zookeeper-shell zookeeper:2181 get /cluster/id 2>/dev/null | awk -F'"' '/"id":/ { print $8; exit }')"

  if [[ -n "$STORED_CLUSTER_ID" && -n "$ZK_CLUSTER_ID" ]]; then
    echo "Kafka bootstrap: persisted cluster.id=$STORED_CLUSTER_ID, zookeeper cluster.id=$ZK_CLUSTER_ID"

    if [[ "$STORED_CLUSTER_ID" != "$ZK_CLUSTER_ID" ]]; then
      echo "Detected Kafka/ZooKeeper cluster.id mismatch; repairing persisted Kafka metadata before startup."
      sed -i "s/^cluster.id=.*/cluster.id=$ZK_CLUSTER_ID/" "$META_FILE"
    fi
  fi
fi

exec /etc/confluent/docker/run
