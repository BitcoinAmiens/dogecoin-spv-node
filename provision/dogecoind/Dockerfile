FROM ubuntu:latest

RUN apt-get update

RUN apt-get -y install wget

WORKDIR /usr/src

RUN wget https://github.com/dogecoin/dogecoin/releases/download/v1.10.0/dogecoin-1.10.0-linux64.tar.gz
RUN tar -xzvf dogecoin-1.10.0-linux64.tar.gz
RUN chmod +x dogecoin-1.10.0/bin/dogecoind dogecoin-1.10.0/bin/dogecoin-cli
RUN ln -s /usr/src/dogecoin-1.10.0/bin/dogecoind /usr/bin/dogecoind
RUN ln -s /usr/src/dogecoin-1.10.0/bin/dogecoin-cli /usr/bin/dogecoin-cli

ADD dogecoin.conf /root/.dogecoin/dogecoin.conf

EXPOSE 44555 44556

CMD ["dogecoind", "-printtoconsole"]
